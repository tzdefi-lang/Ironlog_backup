import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import UIKit

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

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isUploading
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    BotanicalCard {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionHeader("Basic")
                            BotanicalTextField(title: "Name", value: $name)
                            TextField("Description", text: $detail, axis: .vertical)
                                .lineLimit(3 ... 6)
                                .textFieldStyle(.plain)
                                .font(.botanicalBody(15))
                                .padding(12)
                                .background(Color.botanicalSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
                                )
                        }
                    }

                    BotanicalCard {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionHeader("Category")
                            categoryPickerGrid
                        }
                    }

                    BotanicalCard {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionHeader("Barbell")
                            HStack {
                                Text("Uses Barbell")
                                    .font(.botanicalBody(15))
                                    .foregroundStyle(Color.botanicalTextPrimary)
                                Spacer()
                                BotanicalToggle(isOn: $usesBarbell)
                            }

                            if usesBarbell {
                                HStack(spacing: 10) {
                                    Text("Bar Weight")
                                        .font(.botanicalBody(15))
                                        .foregroundStyle(Color.botanicalTextPrimary)
                                    Spacer()
                                    TextField("0", value: $barbellWeight, format: .number.precision(.fractionLength(0 ... 1)))
                                        .keyboardType(.decimalPad)
                                        .textFieldStyle(.plain)
                                        .multilineTextAlignment(.trailing)
                                        .font(.botanicalSemibold(15))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 10)
                                        .frame(width: 110)
                                        .background(Color.botanicalSurface)
                                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(Color.botanicalBorderSubtle, lineWidth: 1)
                                        )
                                    Text("kg")
                                        .font(.caption)
                                        .foregroundStyle(Color.botanicalTextSecondary)
                                }
                            }
                        }
                    }

                    BotanicalCard {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionHeader("Media")

                            PhotosPicker(selection: $selectedPhoto, matching: .any(of: [.images, .videos])) {
                                HStack(spacing: 8) {
                                    Image(systemName: "photo.on.rectangle.angled")
                                    Text(uploadedMediaURL == nil ? "Add Photo or Video" : "Media Uploaded")
                                }
                                .font(.botanicalSemibold(14))
                                .foregroundStyle(Color.botanicalTextPrimary)
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.botanicalAccent.opacity(0.45))
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .onChange(of: selectedPhoto) { _, item in
                                guard let item else { return }
                                Task { await uploadMedia(from: item) }
                            }

                            if isUploading {
                                LoadingStateView(message: "Uploading...")
                            }

                            if let uploadError {
                                ErrorStateView(
                                    title: "Upload failed",
                                    message: LocalizedStringKey(uploadError)
                                )
                            }

                            if uploadedMediaURL != nil {
                                Button {
                                    uploadedMediaURL = nil
                                    uploadedMediaType = nil
                                } label: {
                                    Label("Remove Uploaded Media", systemImage: "xmark")
                                        .font(.caption)
                                }
                                .foregroundStyle(.red)
                                .buttonStyle(.plain)
                            }

                            BotanicalTextField(title: "YouTube Link (optional)", value: $youtubeLink)
                                .keyboardType(.URL)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 24)
            .background(Color.botanicalBackground.ignoresSafeArea())
            .navigationTitle("New Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await saveExercise() }
                    }
                    .disabled(!canSave)
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

    private var categoryPickerGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 94), spacing: 8)], spacing: 8) {
            ForEach(Constants.bodyPartOptions, id: \.self) { option in
                Button(option) {
                    withAnimation(.easeOut(duration: 0.2)) {
                        category = option
                    }
                    HapticManager.shared.selection()
                }
                .font(.botanicalSemibold(13))
                .foregroundStyle(category == option ? Color.botanicalTextPrimary : Color.botanicalTextSecondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(category == option ? Color.botanicalAccent : Color.botanicalMuted.opacity(0.65))
                .clipShape(Capsule())
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.botanicalSemibold(14))
            .foregroundStyle(Color.botanicalTextSecondary)
            .textCase(.uppercase)
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
