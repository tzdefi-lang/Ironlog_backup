import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct EditExerciseSheet: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var draft: ExerciseDef
    @State private var youtubeLink: String
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var uploadedMediaURL: String?
    @State private var uploadedMediaType: ExerciseMediaContentType?
    @State private var isUploading = false
    @State private var uploadError: String?

    init(exercise: ExerciseDef) {
        _draft = State(initialValue: exercise)
        _youtubeLink = State(initialValue: exercise.mediaItems.first(where: { $0.kind == .youtube })?.url ?? "")
        _uploadedMediaURL = State(initialValue: exercise.mediaItems.first(where: { $0.kind == .upload })?.url ?? exercise.mediaUrl)
        _uploadedMediaType = State(initialValue: exercise.mediaItems.first(where: { $0.kind == .upload })?.contentType ?? exercise.mediaType)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Basic") {
                    TextField("Name", text: $draft.name)
                    TextField("Description", text: $draft.description, axis: .vertical)
                        .lineLimit(3 ... 6)
                }

                Section("Category") {
                    Picker("Category", selection: $draft.category) {
                        ForEach(Constants.bodyPartOptions, id: \.self) { Text($0).tag($0) }
                    }
                }

                Section("Barbell") {
                    Toggle("Uses Barbell", isOn: $draft.usesBarbell)
                    if draft.usesBarbell {
                        HStack {
                            Text("Bar Weight")
                            Spacer()
                            TextField("kg", value: $draft.barbellWeight, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 90)
                            Text("kg")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Media") {
                    PhotosPicker(selection: $selectedPhoto, matching: .any(of: [.images, .videos])) {
                        HStack {
                            Image(systemName: "photo.on.rectangle.angled")
                            Text(uploadedMediaURL == nil ? "Replace with Photo or Video" : "Media Uploaded ✓")
                        }
                    }
                    .onChange(of: selectedPhoto) { _, item in
                        guard let item else { return }
                        Task { await uploadMedia(from: item) }
                    }

                    if isUploading {
                        ProgressView("Uploading...")
                    }

                    if let uploadError {
                        Text(uploadError)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    if uploadedMediaURL != nil {
                        Button("Remove Uploaded Media", role: .destructive) {
                            uploadedMediaURL = nil
                            uploadedMediaType = nil
                        }
                    }

                    TextField("YouTube Link (optional)", text: $youtubeLink)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .navigationTitle("Edit Exercise")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await saveExercise() }
                    }
                    .disabled(draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isUploading)
                }
            }
        }
    }

    private func uploadMedia(from item: PhotosPickerItem) async {
        isUploading = true
        uploadError = nil
        defer { isUploading = false }

        let type = item.supportedContentTypes.first
        let fileExtension = type?.preferredFilenameExtension ?? "dat"
        let contentType = type?.preferredMIMEType ?? "application/octet-stream"
        let mediaType: ExerciseMediaContentType = (type?.conforms(to: .movie) == true || type?.conforms(to: .video) == true) ? .video : .image

        guard let data = try? await item.loadTransferable(type: Data.self) else {
            uploadError = "Failed to read media data."
            return
        }

        let path = "exercises/\(UUID().uuidString).\(fileExtension)"

        do {
            let uploadedURL = try await MediaUploadService.shared.upload(data: data, path: path, contentType: contentType)
            uploadedMediaURL = uploadedURL
            uploadedMediaType = mediaType
        } catch {
            uploadError = "Upload failed. Please try again."
        }
    }

    private func saveExercise() async {
        let cleanYoutube = youtubeLink.trimmingCharacters(in: .whitespacesAndNewlines)
        var mediaItems: [ExerciseMediaItem] = []

        if let uploadedMediaURL {
            mediaItems.append(
                ExerciseMediaItem(
                    id: UUID().uuidString,
                    kind: .upload,
                    contentType: uploadedMediaType ?? .image,
                    url: uploadedMediaURL,
                    title: nil
                )
            )
        }

        if !cleanYoutube.isEmpty {
            mediaItems.append(
                ExerciseMediaItem(
                    id: UUID().uuidString,
                    kind: .youtube,
                    contentType: .video,
                    url: cleanYoutube,
                    title: "YouTube"
                )
            )
        }

        draft.name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        draft.mediaItems = mediaItems
        draft.mediaUrl = uploadedMediaURL
        draft.mediaType = uploadedMediaType
        draft.thumbnailUrl = uploadedMediaType == .image ? uploadedMediaURL : nil
        if !draft.usesBarbell {
            draft.barbellWeight = 0
        }

        await store.updateExerciseDef(draft)
        store.pushToast("Exercise updated")
        dismiss()
    }
}
