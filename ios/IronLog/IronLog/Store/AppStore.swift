import Foundation
import Observation
import SwiftData

struct AppToast: Identifiable, Equatable, Sendable {
    let id = UUID()
    let message: String
    let duration: Double
}

private struct CachedUserIdentity: Codable, Sendable {
    var privyDid: String?
    var name: String?
    var email: String?
    var photoUrl: String?
    var loginMethod: String?
}

private struct UserProfileMetadataRow: Codable, Sendable {
    var user_id: String
    var created_at: String
    var last_login_at: String?
    var subscription_tier: String?
    var subscription_status: String?
}

@MainActor
@Observable
final class AppStore {
    var user: UserProfile?
    var workouts: [Workout] = []
    var exerciseDefs: [ExerciseDef] = []
    var templates: [WorkoutTemplate] = []
    var isLoading = true
    var isBootstrappingSession = true
    var authError: String?
    var activeToast: AppToast?

    var activeWorkoutID: String?
    var showWorkoutEditor = false

    private var personalExerciseDefs: [ExerciseDef] = []
    private var officialExerciseDefs: [ExerciseDef] = []
    private var personalTemplates: [WorkoutTemplate] = []
    private var officialTemplates: [WorkoutTemplate] = []

    private let authService: PrivyAuthService
    private let tokenExchangeService: TokenExchangeService
    private let workoutRepo: WorkoutRepository
    private let exerciseRepo: ExerciseDefRepository
    private let templateRepo: TemplateRepository
    private let officialRepo: OfficialContentRepository
    private let officialAdminService: OfficialContentAdminService
    private let networkMonitor: NetworkMonitor
    private let syncQueue: SyncQueue
    private let syncOperationService: SyncOperationService
    private var activeAuthAttemptId: UUID?
    private var toastQueue: [AppToast] = []
    private var toastTask: Task<Void, Never>?
    private var restoredGlobalThemeMode: ThemeMode?
    private var isUITestModeEnabled = false

    init(
        modelContext: ModelContext,
        authService: PrivyAuthService = PrivyAuthService(),
        tokenExchangeService: TokenExchangeService = TokenExchangeService(),
        workoutRepo: WorkoutRepository = WorkoutRepository(),
        exerciseRepo: ExerciseDefRepository = ExerciseDefRepository(),
        templateRepo: TemplateRepository = TemplateRepository(),
        officialRepo: OfficialContentRepository = OfficialContentRepository(),
        officialAdminService: OfficialContentAdminService = OfficialContentAdminService(),
        syncOperationService: SyncOperationService = SyncOperationService(),
        networkMonitor: NetworkMonitor = .shared
    ) {
        self.syncQueue = SyncQueue(modelContext: modelContext)
        self.authService = authService
        self.tokenExchangeService = tokenExchangeService
        self.workoutRepo = workoutRepo
        self.exerciseRepo = exerciseRepo
        self.templateRepo = templateRepo
        self.officialRepo = officialRepo
        self.officialAdminService = officialAdminService
        self.syncOperationService = syncOperationService
        self.networkMonitor = networkMonitor
        registerReconnectObserver()
        restoreThemeFromGlobal()
        isLoading = false
    }

    var isAdmin: Bool {
        guard let email = user?.email.lowercased() else { return false }
        return Constants.adminEmails.contains(email)
    }

    func enableUITestMode() {
        let fixtures = defaultUITestFixtures()
        isUITestModeEnabled = true
        user = fixtures.user
        workouts = fixtures.workouts.sorted { $0.date > $1.date }
        personalExerciseDefs = fixtures.exerciseDefs.filter { $0.source == .personal }
        officialExerciseDefs = fixtures.exerciseDefs.filter { $0.source == .official }
        personalTemplates = fixtures.templates.filter { $0.source == .personal }
        officialTemplates = fixtures.templates.filter { $0.source == .official }
        mergeDerivedCollections()

        authError = nil
        isLoading = false
        isBootstrappingSession = false
        activeWorkoutID = nil
        showWorkoutEditor = false
        activeToast = nil
        toastQueue.removeAll()
        toastTask?.cancel()
    }

    func loginWithPrivy(provider: PrivyLoginProvider) async {
        let attemptId = beginAuthAttempt()
        defer { finishAuthAttempt(attemptId) }

        do {
            let login = try await authService.loginWithOAuth(provider: provider)
            guard isActiveAuthAttempt(attemptId) else { return }
            await completeLogin(exchange: login.exchange, profile: login.profile)
        } catch {
            guard isActiveAuthAttempt(attemptId) else { return }
            handleLoginFailure(error)
        }
    }

    func login(withPrivyToken token: String) async {
        let attemptId = beginAuthAttempt()
        defer { finishAuthAttempt(attemptId) }

        do {
            let result = try await authService.handlePrivyToken(token)
            guard isActiveAuthAttempt(attemptId) else { return }
            await completeLogin(exchange: result, profile: nil)
        } catch {
            guard isActiveAuthAttempt(attemptId) else { return }
            handleLoginFailure(error)
        }
    }

    func sendEmailOTP(to email: String) async {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty else {
            authError = "Email is required."
            return
        }

        authError = nil
        do {
            try await authService.sendEmailOTP(to: cleanEmail)
        } catch {
            authError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func verifyEmailOTP(code: String, email: String) async {
        let attemptId = beginAuthAttempt()
        defer { finishAuthAttempt(attemptId) }

        do {
            let result = try await authService.verifyEmailOTP(code: code, to: email)
            guard isActiveAuthAttempt(attemptId) else { return }
            await completeLogin(exchange: result.exchange, profile: result.profile)
        } catch {
            guard isActiveAuthAttempt(attemptId) else { return }
            handleLoginFailure(error, fallbackMessage: "Invalid code. Please try again.")
        }
    }

    func logout() async {
        SupabaseClientProvider.shared.clearAuthToken()
        authService.logout()
        tokenExchangeService.clear()

        clearSessionState()
        authError = nil
    }

    func refreshData() async {
        if isUITestModeEnabled { return }
        guard user != nil else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            async let fetchedWorkouts = workoutRepo.fetchWorkouts()
            async let fetchedDefs = exerciseRepo.fetchPersonal()
            async let fetchedTemplates = templateRepo.fetchPersonal()
            async let fetchedOfficial = officialRepo.fetch()

            workouts = try await fetchedWorkouts
            personalExerciseDefs = try await fetchedDefs
            personalTemplates = try await fetchedTemplates

            let official = try await fetchedOfficial
            officialExerciseDefs = official.exerciseDefs
            officialTemplates = official.templates
            mergeDerivedCollections()
        } catch {
            authError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    func attemptSessionRestore() async {
        if isUITestModeEnabled {
            isBootstrappingSession = false
            return
        }
        guard isBootstrappingSession else { return }
        defer { isBootstrappingSession = false }

        guard user == nil else { return }
        if let restored = tokenExchangeService.restoreSession() {
            SupabaseClientProvider.shared.setAuthToken(restored.token)
            let restoredProfile = await authService.restoreProfileIfPossible()
            mapPrivyUser(userId: restored.userId, profile: restoredProfile)
            await syncUserProfileMetadata(for: restored.userId)
            await refreshData()
            await consumeSyncQueue()
            return
        }

        guard let refreshed = await authService.restoreSessionIfPossible() else { return }
        SupabaseClientProvider.shared.setAuthToken(refreshed.token)
        let refreshedProfile = await authService.restoreProfileIfPossible()
        mapPrivyUser(userId: refreshed.userId, profile: refreshedProfile)
        await syncUserProfileMetadata(for: refreshed.userId)
        await refreshData()
        await consumeSyncQueue()
    }

    func refreshOfficialContent() async {
        if isUITestModeEnabled { return }
        do {
            let official = try await officialRepo.fetch(forceRefresh: true)
            officialExerciseDefs = official.exerciseDefs
            officialTemplates = official.templates
            mergeDerivedCollections()
        } catch {
            AppLogger.appStore.error("Failed to refresh official content: \((error as NSError).localizedDescription, privacy: .public)")
        }
    }

    func addWorkout(_ workout: Workout) async {
        let persisted = normalizedForPersistence(workout)
        workouts.append(persisted)
        if isUITestModeEnabled { return }
        guard let user else { return }

        do {
            try await workoutRepo.upsert(persisted, userId: user.id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "workouts", action: "upsert", payload: WorkoutRow.from(persisted, userId: user.id))
            } else {
                workouts.removeAll { $0.id == persisted.id }
                handleStoreWriteFailure(error)
            }
        }
    }

    func updateWorkout(_ workout: Workout) async {
        let persisted = normalizedForPersistence(workout)
        let previous = workouts
        workouts = workouts.map { $0.id == persisted.id ? persisted : $0 }
        if isUITestModeEnabled { return }
        guard let user else { return }

        do {
            try await workoutRepo.upsert(persisted, userId: user.id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "workouts", action: "upsert", payload: WorkoutRow.from(persisted, userId: user.id))
            } else {
                workouts = previous
                handleStoreWriteFailure(error)
            }
        }
    }

    func deleteWorkout(id: String) async {
        let previous = workouts
        workouts.removeAll { $0.id == id }
        if isUITestModeEnabled { return }
        guard let user else { return }

        do {
            try await workoutRepo.delete(id: id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "workouts", action: "delete", payload: ["id": id, "user_id": user.id])
            } else {
                workouts = previous
                handleStoreWriteFailure(error)
            }
        }
    }

    func copyWorkout(workoutId: String, targetDate: String) async {
        guard let source = workouts.first(where: { $0.id == workoutId }) else { return }

        let copied = Workout(
            id: UUID().uuidString,
            date: targetDate,
            title: source.title,
            note: source.note,
            exercises: source.exercises.enumerated().map { index, exercise in
                ExerciseInstance(
                    id: UUID().uuidString,
                    defId: exercise.defId,
                    sets: exercise.sets.map {
                        WorkoutSet(id: UUID().uuidString, weight: $0.weight, reps: $0.reps, completed: false)
                    },
                    sortOrder: index
                )
            },
            completed: false,
            elapsedSeconds: 0,
            startTimestamp: nil
        )

        await addWorkout(copied)
    }

    func addExerciseDef(_ def: ExerciseDef) async {
        guard let user else { return }
        guard def.source == .personal, !def.readOnly else { return }

        let previous = personalExerciseDefs
        personalExerciseDefs.append(def)
        mergeDerivedCollections()
        if isUITestModeEnabled { return }

        do {
            try await exerciseRepo.upsert(def, userId: user.id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "exercise_defs", action: "upsert", payload: ExerciseDefRow.from(def, userId: user.id))
            } else {
                personalExerciseDefs = previous
                mergeDerivedCollections()
                handleStoreWriteFailure(error)
            }
        }
    }

    func updateExerciseDef(_ def: ExerciseDef) async {
        guard let user else { return }
        guard def.source == .personal, !def.readOnly else { return }

        let previous = personalExerciseDefs
        personalExerciseDefs = personalExerciseDefs.map { $0.id == def.id ? def : $0 }
        mergeDerivedCollections()
        if isUITestModeEnabled { return }

        do {
            try await exerciseRepo.upsert(def, userId: user.id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "exercise_defs", action: "upsert", payload: ExerciseDefRow.from(def, userId: user.id))
            } else {
                personalExerciseDefs = previous
                mergeDerivedCollections()
                handleStoreWriteFailure(error)
            }
        }
    }

    func deleteExerciseDef(id: String) async {
        guard let user else { return }
        let previous = personalExerciseDefs
        personalExerciseDefs.removeAll { $0.id == id }
        mergeDerivedCollections()
        if isUITestModeEnabled { return }

        do {
            try await exerciseRepo.delete(id: id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "exercise_defs", action: "delete", payload: ["id": id, "user_id": user.id])
            } else {
                personalExerciseDefs = previous
                mergeDerivedCollections()
                handleStoreWriteFailure(error)
            }
        }
    }

    func addTemplateFromWorkout(name: String, workout: Workout) async {
        guard let user else { return }
        let previous = personalTemplates

        var setsByDef: [String: Int] = [:]
        for exercise in workout.exercises {
            setsByDef[exercise.defId] = max(setsByDef[exercise.defId] ?? 0, max(1, exercise.sets.count))
        }

        let template = WorkoutTemplate(
            id: UUID().uuidString,
            name: name.isEmpty ? workout.title : name,
            source: .personal,
            readOnly: false,
            description: "",
            tagline: "",
            exercises: setsByDef.map { WorkoutTemplateExercise(defId: $0.key, defaultSets: $0.value) },
            createdAt: ISO8601DateFormatter().string(from: Date())
        )

        personalTemplates = ([template] + personalTemplates).sorted { $0.createdAt > $1.createdAt }
        mergeDerivedCollections()
        if isUITestModeEnabled { return }

        do {
            try await templateRepo.upsert(template, userId: user.id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "workout_templates", action: "upsert", payload: WorkoutTemplateRow.from(template, userId: user.id))
            } else {
                personalTemplates = previous
                mergeDerivedCollections()
                handleStoreWriteFailure(error)
            }
        }
    }

    func createOfficialExercise(name: String) async {
        guard isAdmin else {
            pushToast("Admin access denied")
            return
        }

        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else { return }

        let def = ExerciseDef(
            id: UUID().uuidString,
            name: cleanName,
            description: "",
            source: .official,
            readOnly: true,
            thumbnailUrl: nil,
            markdown: "",
            mediaItems: [],
            mediaUrl: nil,
            mediaType: nil,
            category: "Other",
            usesBarbell: false,
            barbellWeight: 0
        )

        do {
            try await officialAdminService.upsertOfficialExercise(def)
            await refreshOfficialContent()
            pushToast("Official exercise saved")
        } catch {
            authError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            pushToast("Failed to save official exercise")
        }
    }

    func createOfficialTemplate(name: String) async {
        guard isAdmin else {
            pushToast("Admin access denied")
            return
        }

        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty else { return }
        guard let seedExercise = officialExerciseDefs.first else {
            pushToast("Create an official exercise first")
            return
        }

        let template = WorkoutTemplate(
            id: UUID().uuidString,
            name: cleanName,
            source: .official,
            readOnly: true,
            description: "",
            tagline: "",
            exercises: [WorkoutTemplateExercise(defId: seedExercise.id, defaultSets: 3)],
            createdAt: ISO8601DateFormatter().string(from: Date())
        )

        do {
            try await officialAdminService.upsertOfficialTemplate(template)
            await refreshOfficialContent()
            pushToast("Official template saved")
        } catch {
            authError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            pushToast("Failed to save official template")
        }
    }

    func startWorkoutFromTemplate(templateId: String, targetDate: String) async -> Workout? {
        guard let template = templates.first(where: { $0.id == templateId }) else { return nil }

        let defIds = Set(exerciseDefs.map(\.id))
        let instances = template.exercises
            .filter { defIds.contains($0.defId) }
            .enumerated()
            .map { index, item in
                ExerciseInstance(
                    id: UUID().uuidString,
                    defId: item.defId,
                    sets: (0..<max(1, item.defaultSets)).map { _ in
                        WorkoutSet(id: UUID().uuidString, weight: 0, reps: 0, completed: false)
                    },
                    sortOrder: index
                )
            }

        guard !instances.isEmpty else { return nil }

        let workout = Workout(
            id: UUID().uuidString,
            date: targetDate,
            title: template.name,
            note: "",
            exercises: instances,
            completed: false,
            elapsedSeconds: 0,
            startTimestamp: nil
        )

        await addWorkout(workout)
        return workout
    }

    func deleteTemplate(id: String) async {
        guard let user else { return }
        let previous = personalTemplates
        personalTemplates.removeAll { $0.id == id }
        mergeDerivedCollections()
        if isUITestModeEnabled { return }

        do {
            try await templateRepo.delete(id: id)
        } catch {
            if shouldQueueForRetry(error) {
                await queueOfflineOperation(table: "workout_templates", action: "delete", payload: ["id": id, "user_id": user.id])
            } else {
                personalTemplates = previous
                mergeDerivedCollections()
                handleStoreWriteFailure(error)
            }
        }
    }

    func toggleUnit() {
        guard var user else { return }
        user.preferences.defaultUnit = user.preferences.defaultUnit == .kg ? .lbs : .kg
        self.user = user
        savePreferences(user.preferences)
    }

    func setRestTimerSeconds(_ seconds: Int) {
        guard var user else { return }
        let clamped = max(10, min(300, seconds))
        user.preferences.restTimerSeconds = clamped
        self.user = user
        savePreferences(user.preferences)
    }

    func setThemeMode(_ mode: ThemeMode) {
        guard var user else { return }
        user.preferences.themeMode = mode
        self.user = user
        savePreferences(user.preferences)
        UserDefaults.standard.set(mode.rawValue, forKey: "ironlog_theme_mode")
    }

    func setNotificationsEnabled(_ enabled: Bool) {
        guard var user else { return }
        user.preferences.notificationsEnabled = enabled
        self.user = user
        savePreferences(user.preferences)
    }

    func setAutoRestTimer(_ enabled: Bool) {
        guard var user else { return }
        user.preferences.autoRestTimer = enabled
        self.user = user
        savePreferences(user.preferences)
    }

    func openNewWorkout() {
        activeWorkoutID = nil
        showWorkoutEditor = true
    }

    func openWorkout(id: String) {
        activeWorkoutID = id
        showWorkoutEditor = true
    }

    func pushToast(_ message: String, duration: Double = 2.1) {
        let clean = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        toastQueue.append(AppToast(message: clean, duration: duration))
        showNextToastIfNeeded()
    }

    func dismissToast() {
        toastTask?.cancel()
        activeToast = nil
        showNextToastIfNeeded()
    }

    private func completeLogin(exchange: TokenExchangeResult, profile: PrivyNativeProfile?) async {
        SupabaseClientProvider.shared.setAuthToken(exchange.token)
        mapPrivyUser(userId: exchange.userId, profile: profile)
        await syncUserProfileMetadata(for: exchange.userId)
        await refreshData()
        await consumeSyncQueue()
    }

    private func handleLoginFailure(_ error: Error, fallbackMessage: String? = nil) {
        authError = fallbackMessage ?? (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        SupabaseClientProvider.shared.clearAuthToken()
        clearSessionState()
    }

    private func beginAuthAttempt() -> UUID {
        let attemptId = UUID()
        activeAuthAttemptId = attemptId
        isLoading = true
        authError = nil
        return attemptId
    }

    private func finishAuthAttempt(_ attemptId: UUID) {
        guard activeAuthAttemptId == attemptId else { return }
        activeAuthAttemptId = nil
        isLoading = false
    }

    private func isActiveAuthAttempt(_ attemptId: UUID) -> Bool {
        activeAuthAttemptId == attemptId
    }

    private func clearSessionState() {
        user = nil
        workouts = []
        personalExerciseDefs = []
        officialExerciseDefs = []
        personalTemplates = []
        officialTemplates = []
        mergeDerivedCollections()
    }

    private func mapPrivyUser(userId: String, profile: PrivyNativeProfile?) {
        var saved = loadPreferences(for: userId)
        if let restoredGlobalThemeMode {
            saved.themeMode = restoredGlobalThemeMode
        }
        let cached = loadCachedIdentity(for: userId)
        let inMemory = user?.id == userId ? user : nil

        let profileEmail = normalize(profile?.email)
        let memoryEmail = normalize(inMemory?.email)
        let cachedEmail = normalize(cached?.email)
        let finalEmail = profileEmail ?? memoryEmail ?? cachedEmail ?? ""

        let profileName = normalize(profile?.name)
        let memoryName = normalize(inMemory?.name)
        let cachedName = normalize(cached?.name)
        let fallbackName = finalEmail.split(separator: "@").first.map(String.init)
        let finalName = profileName ?? memoryName ?? cachedName ?? fallbackName ?? "User"

        let finalPrivyDid = normalize(profile?.privyDid) ?? normalize(inMemory?.privyDid) ?? normalize(cached?.privyDid)
        let finalPhoto = normalize(profile?.photoUrl) ?? normalize(inMemory?.photoUrl) ?? normalize(cached?.photoUrl)
        let finalLoginMethod = normalize(profile?.loginMethod) ?? normalize(inMemory?.loginMethod) ?? normalize(cached?.loginMethod) ?? "privy"
        let finalCreatedAt = inMemory?.createdAt
        let finalSubscriptionTier = inMemory?.subscriptionTier
        let finalSubscriptionStatus = inMemory?.subscriptionStatus
        let nowISO = ISO8601DateFormatter().string(from: Date())

        user = UserProfile(
            id: userId,
            privyDid: finalPrivyDid,
            name: finalName,
            email: finalEmail,
            photoUrl: finalPhoto,
            loginMethod: finalLoginMethod,
            preferences: saved,
            createdAt: finalCreatedAt ?? nowISO,
            lastLoginAt: nowISO,
            subscriptionTier: finalSubscriptionTier,
            subscriptionStatus: finalSubscriptionStatus
        )

        saveCachedIdentity(
            CachedUserIdentity(
                privyDid: finalPrivyDid,
                name: finalName,
                email: finalEmail,
                photoUrl: finalPhoto,
                loginMethod: finalLoginMethod
            ),
            for: userId
        )
    }

    private func syncUserProfileMetadata(for userId: String) async {
        guard var currentUser = user, currentUser.id == userId else {
            return
        }

        let nowISO = ISO8601DateFormatter().string(from: Date())

        do {
            let existingRows: [UserProfileMetadataRow] = try await SupabaseClientProvider.shared.client.database
                .from("user_profiles")
                .select()
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value

            let mergedRow: UserProfileMetadataRow
            if var existing = existingRows.first {
                existing.last_login_at = nowISO
                if normalize(existing.subscription_tier) == nil {
                    existing.subscription_tier = currentUser.subscriptionTier ?? "free"
                }
                if normalize(existing.subscription_status) == nil {
                    existing.subscription_status = currentUser.subscriptionStatus ?? "active"
                }
                mergedRow = existing
            } else {
                mergedRow = UserProfileMetadataRow(
                    user_id: userId,
                    created_at: currentUser.createdAt ?? nowISO,
                    last_login_at: nowISO,
                    subscription_tier: currentUser.subscriptionTier ?? "free",
                    subscription_status: currentUser.subscriptionStatus ?? "active"
                )
            }

            try await SupabaseClientProvider.shared.client.database
                .from("user_profiles")
                .upsert(mergedRow)
                .execute()

            currentUser.createdAt = normalize(mergedRow.created_at) ?? currentUser.createdAt ?? nowISO
            currentUser.lastLoginAt = normalize(mergedRow.last_login_at) ?? nowISO
            currentUser.subscriptionTier = normalize(mergedRow.subscription_tier) ?? currentUser.subscriptionTier
            currentUser.subscriptionStatus = normalize(mergedRow.subscription_status) ?? currentUser.subscriptionStatus
            user = currentUser
        } catch {
            AppLogger.appStore.error("Failed to sync user profile metadata: \((error as NSError).localizedDescription, privacy: .public)")
        }
    }

    private func mergeDerivedCollections() {
        var defsById: [String: ExerciseDef] = [:]
        for def in officialExerciseDefs { defsById[def.id] = def }
        for def in personalExerciseDefs { defsById[def.id] = def }
        exerciseDefs = defsById.values.sorted {
            if $0.source != $1.source { return $0.source == .official }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }

        var templatesById: [String: WorkoutTemplate] = [:]
        for template in officialTemplates { templatesById[template.id] = template }
        for template in personalTemplates { templatesById[template.id] = template }
        templates = templatesById.values.sorted { $0.createdAt > $1.createdAt }
    }

    private func shouldQueueForRetry(_ error: Error) -> Bool {
        if !networkMonitor.isConnected {
            AppLogger.sync.debug("Store write failed while network monitor reports offline")
        }
        return SyncErrorClassifier.disposition(for: error) == .retry
    }

    private func handleStoreWriteFailure(_ error: Error) {
        let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        authError = message
        AppLogger.appStore.error("Store write failed: \(message, privacy: .public)")
    }

    private func normalizedForPersistence(_ workout: Workout) -> Workout {
        var normalized = workout
        normalized.exercises = workout.exercises.enumerated().map { index, exercise in
            var updated = exercise
            updated.sortOrder = index
            return updated
        }
        return normalized
    }

    private func queueOfflineOperation<T: Encodable>(table: String, action: String, payload: T) async {
        guard let user else {
            AppLogger.sync.warning("Skipping queue operation without active user. table=\(table, privacy: .public) action=\(action, privacy: .public)")
            return
        }

        let trimmedUserId = user.id.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedUserId.isEmpty else {
            AppLogger.sync.error("Skipping queue operation with empty user id. table=\(table, privacy: .public) action=\(action, privacy: .public)")
            return
        }

        do {
            let data = try JSONEncoder().encode(payload)
            try await syncQueue.enqueue(userId: trimmedUserId, table: table, action: action, payload: data)
        } catch {
            AppLogger.sync.error("Failed to enqueue offline operation \(table, privacy: .public).\(action, privacy: .public): \((error as NSError).localizedDescription, privacy: .public)")
        }
    }

    private func consumeSyncQueue() async {
        guard let user else { return }
        AppLogger.sync.debug("Consuming sync queue for user \(user.id, privacy: .public)")
        await syncQueue.flush(userId: user.id) { [weak self] item in
            guard let self else { return }
            try await self.executeQueueItem(item)
        }
    }

    private func executeQueueItem(_ item: SyncQueueItemModel) async throws {
        let result = try await syncOperationService.execute(item: item)
        if result.deduped {
            AppLogger.sync.log("Deduped queued sync operation idempotencyKey=\(item.idempotencyKey, privacy: .public)")
        } else if result.applied {
            AppLogger.sync.debug("Applied queued sync operation idempotencyKey=\(item.idempotencyKey, privacy: .public)")
        }
    }

    private func defaultUITestFixtures() -> (
        user: UserProfile,
        exerciseDefs: [ExerciseDef],
        workouts: [Workout],
        templates: [WorkoutTemplate]
    ) {
        let benchDef = ExerciseDef(
            id: "def-bench-press",
            name: "Bench Press",
            description: "Classic chest press movement.",
            source: .official,
            readOnly: true,
            thumbnailUrl: nil,
            markdown: "Lie on the bench, keep your feet grounded, and press with control.",
            mediaItems: [],
            mediaUrl: nil,
            mediaType: nil,
            category: "Chest",
            usesBarbell: true,
            barbellWeight: 20
        )

        let rowDef = ExerciseDef(
            id: "def-row",
            name: "Barbell Row",
            description: "Pull with your back and keep the core braced.",
            source: .official,
            readOnly: true,
            thumbnailUrl: nil,
            markdown: "Hinge forward with a neutral spine and row toward your lower ribs.",
            mediaItems: [],
            mediaUrl: nil,
            mediaType: nil,
            category: "Back",
            usesBarbell: true,
            barbellWeight: 20
        )

        let todayWorkout = Workout(
            id: "w-today",
            date: DateUtils.formatDate(),
            title: "Upper Body Session",
            note: "UITest fixture",
            exercises: [
                ExerciseInstance(
                    id: "ex-today-bench",
                    defId: benchDef.id,
                    sets: [
                        WorkoutSet(id: "set-today-1", weight: 100, reps: 5, completed: true),
                        WorkoutSet(id: "set-today-2", weight: 100, reps: 5, completed: false),
                    ],
                    sortOrder: 0
                ),
                ExerciseInstance(
                    id: "ex-today-row",
                    defId: rowDef.id,
                    sets: [
                        WorkoutSet(id: "set-row-1", weight: 80, reps: 8, completed: false),
                    ],
                    sortOrder: 1
                ),
            ],
            completed: false,
            elapsedSeconds: 900,
            startTimestamp: nil
        )

        let yesterday = Calendar(identifier: .gregorian).date(byAdding: .day, value: -1, to: Date()) ?? Date()
        let twoDaysAgo = Calendar(identifier: .gregorian).date(byAdding: .day, value: -2, to: Date()) ?? Date()

        let lastCompleted = Workout(
            id: "w-last",
            date: DateUtils.formatDate(yesterday),
            title: "Push Day",
            note: "Previous session",
            exercises: [
                ExerciseInstance(
                    id: "ex-last-bench",
                    defId: benchDef.id,
                    sets: [
                        WorkoutSet(id: "set-last-1", weight: 95, reps: 5, completed: true),
                        WorkoutSet(id: "set-last-2", weight: 100, reps: 4, completed: true),
                    ],
                    sortOrder: 0
                ),
            ],
            completed: true,
            elapsedSeconds: 2100,
            startTimestamp: nil
        )

        let olderCompleted = Workout(
            id: "w-older",
            date: DateUtils.formatDate(twoDaysAgo),
            title: "Bench Technique",
            note: "Technique and speed",
            exercises: [
                ExerciseInstance(
                    id: "ex-older-bench",
                    defId: benchDef.id,
                    sets: [
                        WorkoutSet(id: "set-older-1", weight: 90, reps: 6, completed: true),
                        WorkoutSet(id: "set-older-2", weight: 92.5, reps: 5, completed: true),
                    ],
                    sortOrder: 0
                ),
            ],
            completed: true,
            elapsedSeconds: 1800,
            startTimestamp: nil
        )

        let template = WorkoutTemplate(
            id: "tpl-upper",
            name: "Upper Starter",
            source: .official,
            readOnly: true,
            description: "Fixture template",
            tagline: "Chest + Back",
            exercises: [
                WorkoutTemplateExercise(defId: benchDef.id, defaultSets: 3),
                WorkoutTemplateExercise(defId: rowDef.id, defaultSets: 3),
            ],
            createdAt: ISO8601DateFormatter().string(from: Date())
        )

        let user = UserProfile(
            id: "ui-test-user",
            name: "UI Test",
            email: "uitest@example.com",
            preferences: UserPreferences(defaultUnit: .lbs, restTimerSeconds: 90, themeMode: .system, notificationsEnabled: false)
        )

        return (
            user: user,
            exerciseDefs: [benchDef, rowDef],
            workouts: [todayWorkout, lastCompleted, olderCompleted],
            templates: [template]
        )
    }

    private func savePreferences(_ preferences: UserPreferences) {
        guard let user else { return }
        do {
            let data = try JSONEncoder().encode(preferences)
            UserDefaults.standard.set(data, forKey: "ironlog_preferences_\(user.id)")
        } catch {
            AppLogger.appStore.error("Failed to save preferences: \((error as NSError).localizedDescription, privacy: .public)")
        }
    }

    private func loadPreferences(for userId: String) -> UserPreferences {
        guard let data = UserDefaults.standard.data(forKey: "ironlog_preferences_\(userId)") else {
            return .default
        }
        do {
            return try JSONDecoder().decode(UserPreferences.self, from: data)
        } catch {
            AppLogger.appStore.error("Failed to decode preferences for user \(userId, privacy: .public): \((error as NSError).localizedDescription, privacy: .public)")
            return .default
        }
    }

    private func cachedIdentityKey(for userId: String) -> String {
        "ironlog_cached_identity_\(userId)"
    }

    private func saveCachedIdentity(_ identity: CachedUserIdentity, for userId: String) {
        do {
            let data = try JSONEncoder().encode(identity)
            UserDefaults.standard.set(data, forKey: cachedIdentityKey(for: userId))
        } catch {
            AppLogger.appStore.error("Failed to save cached identity for user \(userId, privacy: .public): \((error as NSError).localizedDescription, privacy: .public)")
        }
    }

    private func loadCachedIdentity(for userId: String) -> CachedUserIdentity? {
        guard let data = UserDefaults.standard.data(forKey: cachedIdentityKey(for: userId)) else {
            return nil
        }
        do {
            return try JSONDecoder().decode(CachedUserIdentity.self, from: data)
        } catch {
            AppLogger.appStore.error("Failed to decode cached identity for user \(userId, privacy: .public): \((error as NSError).localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func normalize(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }

    private func restoreThemeFromGlobal() {
        guard user == nil,
              let raw = UserDefaults.standard.string(forKey: "ironlog_theme_mode"),
              let mode = ThemeMode(rawValue: raw) else {
            return
        }
        restoredGlobalThemeMode = mode
    }

    private func registerReconnectObserver() {
        NotificationCenter.default.addObserver(
            forName: .networkDidReconnect,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            AppLogger.sync.log("Received network reconnect event")
            Task { await self?.consumeSyncQueue() }
        }
    }

    private func showNextToastIfNeeded() {
        guard activeToast == nil, !toastQueue.isEmpty else { return }
        activeToast = toastQueue.removeFirst()
        guard let activeToast else { return }

        toastTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .seconds(activeToast.duration))
            } catch {
                return
            }
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.activeToast = nil
                self?.showNextToastIfNeeded()
            }
        }
    }
}
