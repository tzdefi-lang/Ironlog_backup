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
    private var activeAuthAttemptId: UUID?
    private var toastQueue: [AppToast] = []
    private var toastTask: Task<Void, Never>?
    private var restoredGlobalThemeMode: ThemeMode?

    init(
        modelContext: ModelContext,
        authService: PrivyAuthService = PrivyAuthService(),
        tokenExchangeService: TokenExchangeService = TokenExchangeService(),
        workoutRepo: WorkoutRepository = WorkoutRepository(),
        exerciseRepo: ExerciseDefRepository = ExerciseDefRepository(),
        templateRepo: TemplateRepository = TemplateRepository(),
        officialRepo: OfficialContentRepository = OfficialContentRepository(),
        officialAdminService: OfficialContentAdminService = OfficialContentAdminService(),
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
        self.networkMonitor = networkMonitor
        registerReconnectObserver()
        restoreThemeFromGlobal()
        isLoading = false
    }

    var isAdmin: Bool {
        guard let email = user?.email.lowercased() else { return false }
        return Constants.adminEmails.contains(email)
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
        guard isBootstrappingSession else { return }
        defer { isBootstrappingSession = false }

        guard user == nil else { return }
        if let restored = tokenExchangeService.restoreSession() {
            SupabaseClientProvider.shared.setAuthToken(restored.token)
            let restoredProfile = await authService.restoreProfileIfPossible()
            mapPrivyUser(userId: restored.userId, profile: restoredProfile)
            await refreshData()
            await consumeSyncQueue()
            return
        }

        guard let refreshed = await authService.restoreSessionIfPossible() else { return }
        SupabaseClientProvider.shared.setAuthToken(refreshed.token)
        let refreshedProfile = await authService.restoreProfileIfPossible()
        mapPrivyUser(userId: refreshed.userId, profile: refreshedProfile)
        await refreshData()
        await consumeSyncQueue()
    }

    func refreshOfficialContent() async {
        do {
            let official = try await officialRepo.fetch()
            officialExerciseDefs = official.exerciseDefs
            officialTemplates = official.templates
            mergeDerivedCollections()
        } catch {
            // Keep previous official content on transient failures.
        }
    }

    func addWorkout(_ workout: Workout) async {
        workouts.append(workout)
        guard let user else { return }

        do {
            try await workoutRepo.upsert(workout, userId: user.id)
        } catch {
            if networkMonitor.isConnected {
                workouts.removeAll { $0.id == workout.id }
            } else {
                await queueOfflineOperation(table: "workouts", action: "upsert", payload: WorkoutRow.from(workout, userId: user.id))
            }
        }
    }

    func updateWorkout(_ workout: Workout) async {
        let previous = workouts
        workouts = workouts.map { $0.id == workout.id ? workout : $0 }
        guard let user else { return }

        do {
            try await workoutRepo.upsert(workout, userId: user.id)
        } catch {
            if networkMonitor.isConnected {
                workouts = previous
            } else {
                await queueOfflineOperation(table: "workouts", action: "upsert", payload: WorkoutRow.from(workout, userId: user.id))
            }
        }
    }

    func deleteWorkout(id: String) async {
        let previous = workouts
        workouts.removeAll { $0.id == id }
        guard let user else { return }

        do {
            try await workoutRepo.delete(id: id)
        } catch {
            if networkMonitor.isConnected {
                workouts = previous
            } else {
                await queueOfflineOperation(table: "workouts", action: "delete", payload: ["id": id, "user_id": user.id])
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
            exercises: source.exercises.map {
                ExerciseInstance(
                    id: UUID().uuidString,
                    defId: $0.defId,
                    sets: $0.sets.map {
                        WorkoutSet(id: UUID().uuidString, weight: $0.weight, reps: $0.reps, completed: false)
                    }
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

        personalExerciseDefs.append(def)
        mergeDerivedCollections()

        do {
            try await exerciseRepo.upsert(def, userId: user.id)
        } catch {
            if !networkMonitor.isConnected {
                await queueOfflineOperation(table: "exercise_defs", action: "upsert", payload: ExerciseDefRow.from(def, userId: user.id))
            }
        }
    }

    func updateExerciseDef(_ def: ExerciseDef) async {
        guard let user else { return }
        guard def.source == .personal, !def.readOnly else { return }

        personalExerciseDefs = personalExerciseDefs.map { $0.id == def.id ? def : $0 }
        mergeDerivedCollections()

        do {
            try await exerciseRepo.upsert(def, userId: user.id)
        } catch {
            if !networkMonitor.isConnected {
                await queueOfflineOperation(table: "exercise_defs", action: "upsert", payload: ExerciseDefRow.from(def, userId: user.id))
            }
        }
    }

    func deleteExerciseDef(id: String) async {
        guard let user else { return }
        personalExerciseDefs.removeAll { $0.id == id }
        mergeDerivedCollections()

        do {
            try await exerciseRepo.delete(id: id)
        } catch {
            if !networkMonitor.isConnected {
                await queueOfflineOperation(table: "exercise_defs", action: "delete", payload: ["id": id, "user_id": user.id])
            }
        }
    }

    func addTemplateFromWorkout(name: String, workout: Workout) async {
        guard let user else { return }

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

        do {
            try await templateRepo.upsert(template, userId: user.id)
        } catch {
            if !networkMonitor.isConnected {
                await queueOfflineOperation(table: "workout_templates", action: "upsert", payload: WorkoutTemplateRow.from(template, userId: user.id))
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
            .map { item in
                ExerciseInstance(
                    id: UUID().uuidString,
                    defId: item.defId,
                    sets: Array(repeating: WorkoutSet(id: UUID().uuidString, weight: 0, reps: 0, completed: false), count: max(1, item.defaultSets))
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

        do {
            try await templateRepo.delete(id: id)
        } catch {
            if networkMonitor.isConnected {
                personalTemplates = previous
                mergeDerivedCollections()
            } else {
                await queueOfflineOperation(table: "workout_templates", action: "delete", payload: ["id": id, "user_id": user.id])
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
        let options = [30, 60, 90, 120, 180]
        user.preferences.restTimerSeconds = options.contains(seconds) ? seconds : 90
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

        user = UserProfile(
            id: userId,
            privyDid: finalPrivyDid,
            name: finalName,
            email: finalEmail,
            photoUrl: finalPhoto,
            loginMethod: finalLoginMethod,
            preferences: saved
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

    private func queueOfflineOperation<T: Encodable>(table: String, action: String, payload: T) async {
        guard let user else { return }
        guard !user.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? await syncQueue.enqueue(userId: user.id, table: table, action: action, payload: data)
    }

    private func consumeSyncQueue() async {
        guard let user else { return }
        await syncQueue.flush(userId: user.id) { [weak self] item in
            guard let self else { return }
            try await self.executeQueueItem(item)
        }
    }

    private func executeQueueItem(_ item: SyncQueueItemModel) async throws {
        switch (item.table, item.action) {
        case ("workouts", "upsert"):
            let row = try JSONDecoder().decode(WorkoutRow.self, from: item.payloadJSON)
            try await workoutRepo.upsert(row.toDomain(), userId: row.user_id)
        case ("workouts", "delete"):
            let payload = try JSONSerialization.jsonObject(with: item.payloadJSON) as? [String: Any]
            if let id = payload?["id"] as? String {
                try await workoutRepo.delete(id: id)
            }
        case ("exercise_defs", "upsert"):
            let row = try JSONDecoder().decode(ExerciseDefRow.self, from: item.payloadJSON)
            guard let userId = resolvedUserId(row.user_id) else {
                print("Skipping exercise_defs sync item with empty user id")
                return
            }
            try await exerciseRepo.upsert(row.toDomain(source: .personal), userId: userId)
        case ("exercise_defs", "delete"):
            let payload = try JSONSerialization.jsonObject(with: item.payloadJSON) as? [String: Any]
            if let id = payload?["id"] as? String {
                try await exerciseRepo.delete(id: id)
            }
        case ("workout_templates", "upsert"):
            let row = try JSONDecoder().decode(WorkoutTemplateRow.self, from: item.payloadJSON)
            guard let userId = resolvedUserId(row.user_id) else {
                print("Skipping workout_templates sync item with empty user id")
                return
            }
            try await templateRepo.upsert(row.toDomain(source: .personal), userId: userId)
        case ("workout_templates", "delete"):
            let payload = try JSONSerialization.jsonObject(with: item.payloadJSON) as? [String: Any]
            if let id = payload?["id"] as? String {
                try await templateRepo.delete(id: id)
            }
        default:
            break
        }
    }

    private func savePreferences(_ preferences: UserPreferences) {
        guard let user else { return }
        if let data = try? JSONEncoder().encode(preferences) {
            UserDefaults.standard.set(data, forKey: "ironlog_preferences_\(user.id)")
        }
    }

    private func loadPreferences(for userId: String) -> UserPreferences {
        guard let data = UserDefaults.standard.data(forKey: "ironlog_preferences_\(userId)"),
              let decoded = try? JSONDecoder().decode(UserPreferences.self, from: data) else {
            return .default
        }
        return decoded
    }

    private func cachedIdentityKey(for userId: String) -> String {
        "ironlog_cached_identity_\(userId)"
    }

    private func saveCachedIdentity(_ identity: CachedUserIdentity, for userId: String) {
        guard let data = try? JSONEncoder().encode(identity) else { return }
        UserDefaults.standard.set(data, forKey: cachedIdentityKey(for: userId))
    }

    private func loadCachedIdentity(for userId: String) -> CachedUserIdentity? {
        guard let data = UserDefaults.standard.data(forKey: cachedIdentityKey(for: userId)),
              let identity = try? JSONDecoder().decode(CachedUserIdentity.self, from: data) else {
            return nil
        }
        return identity
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

    private func resolvedUserId(_ rowUserId: String?) -> String? {
        let candidate = rowUserId ?? user?.id
        guard let candidate = candidate?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty else {
            return nil
        }
        return candidate
    }

    private func registerReconnectObserver() {
        NotificationCenter.default.addObserver(
            forName: .networkDidReconnect,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { await self?.consumeSyncQueue() }
        }
    }

    private func showNextToastIfNeeded() {
        guard activeToast == nil, !toastQueue.isEmpty else { return }
        activeToast = toastQueue.removeFirst()
        guard let activeToast else { return }

        toastTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(activeToast.duration))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.activeToast = nil
                self?.showNextToastIfNeeded()
            }
        }
    }
}
