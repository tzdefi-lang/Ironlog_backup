import Foundation
import MarkdownUI
import SwiftUI

struct ExerciseDetailModal: View {
    let exerciseDef: ExerciseDef?
    let currentExercise: ExerciseInstance?
    let workouts: [Workout]

    @Environment(\.dismiss) private var dismiss
    @State private var mediaIndex = 0
    @State private var appeared = false

    private var mediaItems: [ExerciseMediaItem] {
        guard let def = exerciseDef else { return [] }
        let deduped = deduplicatedMedia(def.mediaItems)
        if !deduped.isEmpty { return deduped }
        if let fallback = fallbackMediaItem(for: def) {
            return [fallback]
        }
        return []
    }

    private var historySessions: [Workout] {
        workouts
            .filter { workout in
                workout.exercises.contains { $0.defId == exerciseDef?.id }
            }
            .sorted { DateUtils.parseDate($0.date) > DateUtils.parseDate($1.date) }
    }

    private var completedHistorySessions: [Workout] {
        historySessions.filter(\.completed)
    }

    private var oneRMTrend: [(String, Double)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"

        let ordered = completedHistorySessions
            .sorted { DateUtils.parseDate($0.date) < DateUtils.parseDate($1.date) }

        return ordered.compactMap { workout in
            let sets = completedSets(in: workout)
            guard !sets.isEmpty else { return nil }
            let best = sets.reduce(0.0) { max($0, $1.weight * (1 + Double($1.reps) / 30)) }
            let label = formatter.string(from: DateUtils.parseDate(workout.date))
            return (label, best)
        }
    }

    private var currentStats: ExercisePR {
        guard let currentExercise else { return .zero }
        return stats(for: currentExercise.sets)
    }

    private var lastCompletedStats: ExercisePR? {
        for workout in completedHistorySessions {
            let sets = completedSets(in: workout)
            guard !sets.isEmpty else { continue }
            return stats(for: sets)
        }
        return nil
    }

    private var historicalPR: ExercisePR {
        guard let defId = exerciseDef?.id else { return .zero }
        return PRService.calculatePRs(workouts: completedHistorySessions)[defId] ?? .zero
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if !mediaItems.isEmpty {
                        animatedSection(index: 0) { mediaCarousel }
                    }

                    animatedSection(index: 1) { titleSection }

                    animatedSection(index: 2) {
                        VStack(alignment: .leading, spacing: 10) {
                            sectionHeader(L10n.string("exerciseDetail.sectionDescription"), icon: "text.alignleft")
                            descriptionSection
                        }
                    }

                    animatedSection(index: 3) { currentWorkoutProgressSection }
                    animatedSection(index: 4) { statsSection }
                    animatedSection(index: 5) { historySection }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
        }
        .background(Color.botanicalBackground.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onChange(of: exerciseDef?.id) { _, _ in
            mediaIndex = 0
            appeared = false
            withAnimation(BotanicalMotion.standard.delay(0.08)) {
                appeared = true
            }
        }
        .onAppear {
            withAnimation(BotanicalMotion.standard.delay(0.08)) {
                appeared = true
            }
        }
    }

    private func animatedSection<Content: View>(
        index: Int,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)
            .animation(BotanicalMotion.standard.delay(Double(index) * 0.05), value: appeared)
    }

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.botanicalAccent)
            Text(title)
                .font(.botanicalSemibold(16))
                .foregroundStyle(Color.botanicalTextPrimary)
        }
        .padding(.top, 8)
    }

    private var header: some View {
        VStack(spacing: 8) {
            Capsule()
                .fill(Color.botanicalMuted.opacity(0.8))
                .frame(width: 42, height: 5)
                .padding(.top, 8)

            HStack {
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Text("Close")
                        .font(.botanicalSemibold(16))
                        .foregroundStyle(Color.botanicalTextPrimary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.botanicalSurface)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 2)
        }
    }

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(exerciseDef?.name ?? "Exercise")
                .font(.display(28))
                .foregroundStyle(Color.botanicalTextPrimary)

            if let def = exerciseDef {
                HStack(spacing: 8) {
                    Text(def.category)
                        .font(.botanicalSemibold(12))
                        .foregroundStyle(Color.botanicalAccent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.botanicalAccent.opacity(0.15))
                        .clipShape(Capsule())

                    if def.source == .official {
                        Text("Official")
                            .font(.botanicalSemibold(12))
                            .foregroundStyle(Color.botanicalSuccess)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.botanicalSuccess.opacity(0.14))
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var descriptionSection: some View {
        if let markdown = exerciseDef?.markdown.trimmingCharacters(in: .whitespacesAndNewlines), !markdown.isEmpty {
            Markdown(markdown)
                .markdownTheme(.basic)
        } else if let desc = exerciseDef?.description.trimmingCharacters(in: .whitespacesAndNewlines), !desc.isEmpty {
            Text(desc)
                .font(.botanicalBody(15))
                .foregroundStyle(Color.botanicalTextSecondary)
        } else {
            HStack(spacing: 8) {
                Image(systemName: "doc.text")
                    .foregroundStyle(Color.botanicalMuted)
                Text("exerciseDetail.noDescriptionAvailable")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 16)
            .background(Color.botanicalSurface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    @ViewBuilder
    private var currentWorkoutProgressSection: some View {
        if let currentExercise, !currentExercise.sets.isEmpty {
            let total = currentExercise.sets.count
            let completed = currentExercise.sets.filter(\.completed).count
            let progress = total > 0 ? Double(completed) / Double(total) : 0
            let currentVolume = currentExercise.sets
                .filter(\.completed)
                .reduce(0.0) { $0 + $1.weight * Double($1.reps) }

            VStack(alignment: .leading, spacing: 12) {
                sectionHeader(L10n.string("exerciseDetail.sectionCurrentSession"), icon: "flame.fill")

                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(L10n.string("%@/%@ sets", "\(completed)", "\(total)"))
                                .font(.botanicalSemibold(15))
                                .foregroundStyle(Color.botanicalTextPrimary)
                            Spacer()
                            Text("\(Int(progress * 100))%")
                                .font(.botanicalSemibold(15))
                                .foregroundStyle(Color.botanicalAccent)
                        }

                        GeometryReader { geo in
                            let clamped = max(0, min(progress, 1))

                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.botanicalMuted)
                                    .frame(height: 8)
                                Capsule()
                                    .fill(Color.botanicalAccent)
                                    .frame(width: geo.size.width * clamped, height: 8)
                                    .animation(.spring(duration: 0.5), value: clamped)
                            }
                        }
                        .frame(height: 8)
                    }

                    HStack(spacing: 16) {
                        miniStat(label: "exerciseDetail.statsVolume", value: "\(Int(currentVolume))")
                        miniStat(label: "exerciseDetail.statsMaxWeight", value: formatMetric(currentStats.maxWeight, showsDecimal: false))
                        miniStat(label: "exerciseDetail.statsEstimated1RM", value: formatMetric(currentStats.maxEstimated1RM, showsDecimal: true))
                    }

                    VStack(spacing: 6) {
                        ForEach(Array(currentExercise.sets.enumerated()), id: \.element.id) { index, set in
                            HStack(spacing: 10) {
                                Text(L10n.string("Set %@", "\(index + 1)"))
                                    .font(.botanicalSemibold(13))
                                    .foregroundStyle(Color.botanicalTextSecondary)
                                    .frame(width: 48, alignment: .leading)

                                Text("\(Int(set.weight)) × \(set.reps)")
                                    .font(.botanicalBody(14))
                                    .foregroundStyle(Color.botanicalTextPrimary)

                                Spacer()

                                Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                                    .font(.system(size: 16))
                                    .foregroundStyle(set.completed ? Color.botanicalSuccess : Color.botanicalMuted)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                .padding(16)
                .background(Color.botanicalSurface)
                .clipShape(RoundedRectangle(cornerRadius: BotanicalTheme.cardCornerRadius, style: .continuous))
            }
            .accessibilityIdentifier("exerciseDetail.currentSessionSection")
        }
    }

    @ViewBuilder
    private var statsSection: some View {
        if currentExercise != nil {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader(L10n.string("exerciseDetail.sectionPerformance"), icon: "chart.bar.fill")

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        statCard(
                            title: "exerciseDetail.statsVolume",
                            thisValue: currentStats.maxVolume,
                            lastValue: lastCompletedStats?.maxVolume,
                            prValue: historicalPR.maxVolume
                        )

                        statCard(
                            title: "exerciseDetail.statsMaxWeight",
                            thisValue: currentStats.maxWeight,
                            lastValue: lastCompletedStats?.maxWeight,
                            prValue: historicalPR.maxWeight
                        )

                        statCard(
                            title: "exerciseDetail.statsEstimated1RM",
                            thisValue: currentStats.maxEstimated1RM,
                            lastValue: lastCompletedStats?.maxEstimated1RM,
                            prValue: historicalPR.maxEstimated1RM,
                            showsDecimal: true
                        )
                    }
                    .padding(.vertical, 2)
                }
                .padding(.horizontal, -20)
                .padding(.leading, 20)
            }
        }
    }

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader(
                L10n.string("History (%@ sessions)", "\(historySessions.count)"),
                icon: "clock.arrow.circlepath"
            )

            if !oneRMTrend.isEmpty {
                OneRMTrendChart(points: oneRMTrend)
                    .frame(height: 160)
                    .padding(12)
                    .botanicalCard(cornerRadius: 16)
            }

            if historySessions.isEmpty {
                Text("exerciseDetail.empty")
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
                    .botanicalCard(cornerRadius: 14)
            } else {
                ForEach(Array(historySessions.prefix(10))) { workout in
                    historyRow(workout: workout)
                }
            }
        }
    }

    private var mediaCarousel: some View {
        TabView(selection: $mediaIndex) {
            ForEach(Array(mediaItems.enumerated()), id: \.offset) { index, item in
                mediaView(item: item)
                    .tag(index)
                    .padding(.vertical, 2)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .automatic))
        .frame(height: 236)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(alignment: .bottomTrailing) {
            if mediaItems.count > 1 {
                Text("\(mediaIndex + 1)/\(mediaItems.count)")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.botanicalOverlay)
                    .clipShape(Capsule())
                    .padding(10)
            }
        }
    }

    @ViewBuilder
    private func mediaView(item: ExerciseMediaItem) -> some View {
        if item.kind == .youtube, let url = embeddedYouTubeURL(from: item.url) {
            YouTubeWebView(url: url)
                .frame(maxWidth: .infinity)
                .frame(height: 232)
        } else if let url = URL(string: item.url) {
            if item.contentType == .video {
                GifVideoPlayer(url: url)
                    .frame(maxWidth: .infinity)
                    .frame(height: 232)
            } else {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Color.botanicalMuted
                }
                .frame(maxWidth: .infinity)
                .frame(height: 232)
                .clipped()
            }
        } else {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.botanicalMuted)
                .frame(height: 232)
        }
    }

    private func historyRow(workout: Workout) -> some View {
        let sets = completedSets(in: workout)
        let allSets = workout.exercises
            .filter { $0.defId == exerciseDef?.id }
            .flatMap(\.sets)
        let maxWeight = sets.map(\.weight).max() ?? 0
        let totalVolume = sets.reduce(0.0) { $0 + $1.weight * Double($1.reps) }

        return DisclosureGroup {
            VStack(spacing: 4) {
                ForEach(Array(allSets.enumerated()), id: \.element.id) { index, set in
                    HStack {
                        Text(L10n.string("Set %@", "\(index + 1)"))
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.botanicalTextSecondary)
                            .frame(width: 44, alignment: .leading)
                        Text("\(Int(set.weight)) × \(set.reps)")
                            .font(.botanicalBody(13))
                        Spacer()
                        Image(systemName: set.completed ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 14))
                            .foregroundStyle(set.completed ? Color.botanicalSuccess : Color.botanicalMuted)
                    }
                    .padding(.vertical, 2)
                    .accessibilityIdentifier("exerciseDetail.historySetRow")
                }
            }
            .padding(.top, 4)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(DateUtils.formatDisplayDate(workout.date))
                        .font(.botanicalSemibold(14))
                        .foregroundStyle(Color.botanicalTextPrimary)
                    Spacer()

                    Text(workout.completed ? "Completed" : "In Progress")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(workout.completed ? Color.botanicalSuccess : Color.botanicalAccent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background((workout.completed ? Color.botanicalSuccess : Color.botanicalAccent).opacity(0.15))
                        .clipShape(Capsule())
                }

                HStack(spacing: 12) {
                    Label(L10n.string("%@ sets", "\(sets.count)"), systemImage: "number")
                    Label(L10n.string("%@ max", "\(Int(maxWeight))"), systemImage: "scalemass.fill")
                    Label(L10n.string("%@ vol", "\(Int(totalVolume))"), systemImage: "chart.bar.fill")
                }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.botanicalTextSecondary)
            }
        }
        .tint(Color.botanicalTextSecondary)
        .padding(14)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("exerciseDetail.historyRow.\(workout.id)")
    }

    private func miniStat(label: LocalizedStringKey, value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.botanicalSemibold(18))
                .foregroundStyle(Color.botanicalTextPrimary)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func statCard(
        title: LocalizedStringKey,
        thisValue: Double?,
        lastValue: Double?,
        prValue: Double?,
        showsDecimal: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(0.8)

            HStack {
                Text("exerciseDetail.statsThis")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .tracking(0.6)
                Spacer()
                HStack(spacing: 4) {
                    Text(formatMetric(thisValue, showsDecimal: showsDecimal))
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.botanicalTextPrimary)

                    if let thisValue, let lastValue, thisValue > 0, lastValue > 0 {
                        Image(systemName: thisValue >= lastValue ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(thisValue >= lastValue ? Color.botanicalSuccess : Color.botanicalDanger)
                    }
                }
            }

            if let lastValue {
                statRow(label: "exerciseDetail.statsLast", value: lastValue, showsDecimal: showsDecimal)
            }

            HStack {
                Text("exerciseDetail.statsPR")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.botanicalTextSecondary)
                    .tracking(0.6)
                Spacer()
                HStack(spacing: 4) {
                    Text(formatMetric(prValue, showsDecimal: showsDecimal))
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.botanicalEmphasis)

                    if let thisValue, let prValue, thisValue > 0, prValue > 0, thisValue >= prValue {
                        Text("exerciseDetail.newPR")
                            .font(.system(size: 8, weight: .heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.botanicalEmphasis)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(14)
        .frame(width: 220, alignment: .leading)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
        )
    }

    private func statRow(label: LocalizedStringKey, value: Double?, showsDecimal: Bool) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.botanicalTextSecondary)
                .tracking(0.6)

            Spacer()

            Text(formatMetric(value, showsDecimal: showsDecimal))
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(Color.botanicalTextPrimary)
        }
    }

    private func formatMetric(_ value: Double?, showsDecimal: Bool) -> String {
        guard let value, value > 0 else { return "—" }
        if showsDecimal {
            return String(format: "%.1f", value)
        }
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%.1f", value)
    }

    private func stats(for sets: [WorkoutSet]) -> ExercisePR {
        var result = ExercisePR.zero
        var volume = 0.0

        for set in sets where set.completed {
            let oneRM = set.weight * (1 + Double(set.reps) / 30)
            result.maxWeight = max(result.maxWeight, set.weight)
            result.maxEstimated1RM = max(result.maxEstimated1RM, oneRM)
            volume += set.weight * Double(set.reps)
        }

        result.maxVolume = volume
        return result
    }

    private func completedSets(in workout: Workout) -> [WorkoutSet] {
        workout.exercises
            .filter { $0.defId == exerciseDef?.id }
            .flatMap(\.sets)
            .filter(\.completed)
    }

    private func deduplicatedMedia(_ items: [ExerciseMediaItem]) -> [ExerciseMediaItem] {
        var seen = Set<String>()
        return items.filter { item in
            let key = item.url.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !key.isEmpty else { return false }
            if seen.contains(key) {
                return false
            }
            seen.insert(key)
            return true
        }
    }

    private func embeddedYouTubeURL(from raw: String) -> URL? {
        guard let inputURL = URL(string: raw), let host = inputURL.host?.lowercased() else {
            return URL(string: raw)
        }

        if host.contains("youtu.be") {
            let id = inputURL.lastPathComponent
            return URL(string: "https://www.youtube.com/embed/\(id)")
        }

        if host.contains("youtube.com") {
            if inputURL.path.contains("/embed/") {
                return inputURL
            }
            if let components = URLComponents(url: inputURL, resolvingAgainstBaseURL: false),
               let videoID = components.queryItems?.first(where: { $0.name == "v" })?.value {
                return URL(string: "https://www.youtube.com/embed/\(videoID)")
            }
        }

        return URL(string: raw)
    }

    private func fallbackMediaItem(for def: ExerciseDef) -> ExerciseMediaItem? {
        guard let raw = def.mediaUrl, !raw.isEmpty else { return nil }

        let lower = raw.lowercased()
        let isYouTube = lower.contains("youtube.com") || lower.contains("youtu.be")
        let kind: ExerciseMediaKind = isYouTube ? .youtube : .upload
        let contentType: ExerciseMediaContentType = isYouTube ? .video : (def.mediaType ?? .image)

        return ExerciseMediaItem(
            id: "legacy-media-\(def.id)",
            kind: kind,
            contentType: contentType,
            url: raw,
            title: def.name
        )
    }
}
