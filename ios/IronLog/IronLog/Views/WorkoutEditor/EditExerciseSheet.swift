import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import UIKit

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
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    basicCard
                    categoryCard
                    barbellCard
                    mediaCard
                }
                .padding(.horizontal, BotanicalTheme.pagePadding)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(Color.botanicalBackground.ignoresSafeArea())
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
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") {
                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    }
                }
            }
        }
    }

    private var basicCard: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Basic")
                    .font(.botanicalSemibold(15))
                    .foregroundStyle(Color.botanicalTextSecondary)

                TextField("Name", text: $draft.name)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.botanicalBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                TextField("Description", text: $draft.description, axis: .vertical)
                    .lineLimit(3 ... 6)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.botanicalBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private var categoryCard: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Category")
                    .font(.botanicalSemibold(15))
                    .foregroundStyle(Color.botanicalTextSecondary)

                BotanicalSegmentedControl(
                    options: Constants.bodyPartOptions,
                    selection: $draft.category,
                    title: { $0 }
                )
            }
        }
    }

    private var barbellCard: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Uses Barbell")
                        .font(.botanicalBody(15))
                        .foregroundStyle(Color.botanicalTextPrimary)
                    Spacer()
                    BotanicalToggle(isOn: $draft.usesBarbell)
                }

                if draft.usesBarbell {
                    HStack {
                        Text("Bar Weight")
                            .font(.botanicalBody(14))
                        Spacer()
                        NumberStepperField(value: $draft.barbellWeight, step: 2.5)
                            .frame(width: 170)
                    }
                }
            }
        }
    }

    private var mediaCard: some View {
        BotanicalCard {
            VStack(alignment: .leading, spacing: 10) {
                Text("Media")
                    .font(.botanicalSemibold(15))
                    .foregroundStyle(Color.botanicalTextSecondary)

                PhotosPicker(selection: $selectedPhoto, matching: .any(of: [.images, .videos])) {
                    HStack(spacing: 6) {
                        Image(systemName: "photo.on.rectangle.angled")
                        Text(uploadedMediaURL == nil ? "Replace with Photo or Video" : "Media Uploaded")
                        if uploadedMediaURL != nil {
                            Image(systemName: "checkmark.circle.fill")
                        }
                    }
                    .font(.botanicalBody(14))
                    .foregroundStyle(Color.botanicalTextPrimary)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity)
                    .background(Color.botanicalMuted.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .onChange(of: selectedPhoto) { _, item in
                    guard let item else { return }
                    Task { await uploadMedia(from: item) }
                }

                if isUploading {
                    LoadingStateView(message: "Uploading media...")
                }

                if let uploadError {
                    ErrorStateView(
                        title: "Upload failed",
                        message: LocalizedStringKey(uploadError)
                    )
                }

                if uploadedMediaURL != nil {
                    BotanicalButton(title: "Remove Uploaded Media", variant: .danger) {
                        uploadedMediaURL = nil
                        uploadedMediaType = nil
                    }
                }

                TextField("YouTube Link (optional)", text: $youtubeLink)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(Color.botanicalBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
