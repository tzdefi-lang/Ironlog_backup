import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct CreateExerciseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppStore.self) private var store

    @State private var name = ""
    @State private var detail = ""
    @State private var category = "Other"
    @State private var usesBarbell = false
    @State private var barbellWeight: Double = 20
    @State private var youtubeLink = ""
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var uploadedMediaURL: String?
    @State private var uploadedMediaType: ExerciseMediaContentType?
    @State private var isUploading = false
    @State private var uploadError: String?

    let onCreated: (ExerciseDef) -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Basic") {
                    TextField("Name", text: $name)
                    TextField("Description", text: $detail, axis: .vertical)
                        .lineLimit(3 ... 6)
                }

                Section("Category") {
                    Picker("Category", selection: $category) {
                        ForEach(Constants.bodyPartOptions, id: \.self) { Text($0).tag($0) }
                    }
                }

                Section("Barbell") {
                    Toggle("Uses Barbell", isOn: $usesBarbell)
                    if usesBarbell {
                        HStack {
                            Text("Bar Weight")
                            Spacer()
                            TextField("kg", value: $barbellWeight, format: .number)
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
                            Text(uploadedMediaURL == nil ? "Add Photo or Video" : "Media Uploaded ✓")
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
            .navigationTitle("New Exercise")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await saveExercise() }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isUploading)
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
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
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

        let def = ExerciseDef(
            id: UUID().uuidString,
            name: cleanName,
            description: detail,
            source: .personal,
            readOnly: false,
            thumbnailUrl: uploadedMediaType == .image ? uploadedMediaURL : nil,
            markdown: "",
            mediaItems: mediaItems,
            mediaUrl: uploadedMediaURL,
            mediaType: uploadedMediaType,
            category: category,
            usesBarbell: usesBarbell,
            barbellWeight: usesBarbell ? barbellWeight : 0
        )

        await store.addExerciseDef(def)
        onCreated(def)
        store.pushToast("Exercise created")
        dismiss()
    }
}
