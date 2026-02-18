import MarkdownUI
import SwiftUI

struct ExerciseDetailModal: View {
    let exerciseDef: ExerciseDef?
    let currentExercise: ExerciseInstance?
    let workouts: [Workout]

    @Environment(\.dismiss) private var dismiss

    private var historySessions: [Workout] {
        workouts
            .filter { workout in
                workout.exercises.contains { $0.defId == exerciseDef?.id }
            }
            .sorted { DateUtils.parseDate($0.date) > DateUtils.parseDate($1.date) }
    }

    private var oneRMTrend: [(String, Double)] {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d"

        let ordered = historySessions
            .sorted { DateUtils.parseDate($0.date) < DateUtils.parseDate($1.date) }

        return ordered.compactMap { workout in
            let sets = workout.exercises
                .filter { $0.defId == exerciseDef?.id }
                .flatMap(\.sets)
                .filter(\.completed)
            guard !sets.isEmpty else { return nil }
            let best = sets.reduce(0.0) { max($0, $1.weight * (1 + Double($1.reps) / 30)) }
            let label = formatter.string(from: DateUtils.parseDate(workout.date))
            return (label, best)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if let def = exerciseDef, !def.mediaItems.isEmpty {
                        TabView {
                            ForEach(def.mediaItems) { item in
                                mediaView(item: item)
                            }
                        }
                        .tabViewStyle(.page(indexDisplayMode: .automatic))
                        .frame(height: 240)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    Text(exerciseDef?.name ?? "Exercise")
                        .font(.display(28))

                    if let cat = exerciseDef?.category {
                        Text(cat)
                            .font(.botanicalSemibold(12))
                            .foregroundStyle(Color.botanicalAccent)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.botanicalAccent.opacity(0.15))
                            .clipShape(Capsule())
                    }

                    if let markdown = exerciseDef?.markdown, !markdown.isEmpty {
                        Markdown(markdown)
                            .markdownTheme(.basic)
                    } else if let desc = exerciseDef?.description, !desc.isEmpty {
                        Text(desc)
                            .font(.botanicalBody(15))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    } else {
                        Text("No description")
                            .font(.botanicalBody(15))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }

                    if let currentExercise, !currentExercise.sets.isEmpty {
                        let done = currentExercise.sets.filter(\.completed).count
                        Text("Current workout: \(done)/\(currentExercise.sets.count) sets completed")
                            .font(.botanicalBody(14))
                            .foregroundStyle(Color.botanicalTextSecondary)
                    }

                    Divider()

                    Text("History (\(historySessions.count) sessions)")
                        .font(.botanicalSemibold(16))

                    if !oneRMTrend.isEmpty {
                        OneRMTrendChart(points: oneRMTrend)
                            .frame(height: 160)
                            .padding(12)
                            .botanicalCard(cornerRadius: 16)
                    }

                    ForEach(historySessions.prefix(10)) { workout in
                        historyRow(workout: workout)
                    }
                }
                .padding(24)
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    @ViewBuilder
    private func mediaView(item: ExerciseMediaItem) -> some View {
        if item.kind == .youtube, let url = embeddedYouTubeURL(from: item.url) {
            YouTubeWebView(url: url)
                .frame(height: 240)
        } else if let url = URL(string: item.url) {
            if item.contentType == .video {
                GifVideoPlayer(url: url)
                    .frame(height: 240)
            } else {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .scaledToFit()
                } placeholder: {
                    Color.botanicalMuted
                }
                .frame(height: 240)
            }
        } else {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.botanicalMuted)
                .frame(height: 240)
        }
    }

    private func historyRow(workout: Workout) -> some View {
        let sets = workout.exercises
            .filter { $0.defId == exerciseDef?.id }
            .flatMap(\.sets)
            .filter(\.completed)

        let maxWeight = sets.map(\.weight).max() ?? 0
        let totalVolume = sets.reduce(0.0) { $0 + $1.weight * Double($1.reps) }

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(workout.date)
                    .font(.botanicalSemibold(14))
                Spacer()
                Text("\(Int(maxWeight)) kg max")
                    .font(.botanicalBody(13))
                    .foregroundStyle(Color.botanicalTextSecondary)
            }

            Text("\(sets.count) sets · \(Int(totalVolume)) volume")
                .font(.caption)
                .foregroundStyle(Color.botanicalTextSecondary)
        }
        .padding(12)
        .background(Color.botanicalSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
}
