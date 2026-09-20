import SwiftUI
import MochaCore
import MochaLAN

public struct MochaRootView: View {
    @ObservedObject var store: TableStore
    @Environment(\.scenePhase) private var scenePhase
    public init(store: TableStore) { self.store = store }
    public var body: some View {
        ZStack {
            TableTheme.background.ignoresSafeArea()
            if store.profile == nil { ProfileView(store: store, editing: false) }
            else if let room = store.room { RoomScreen(store: store, room: room) }
            else { HomeView(store: store) }
            if scenePhase != .active {
                TableTheme.background.ignoresSafeArea()
                VStack(spacing: 16) { Image(systemName: "suit.diamond.fill").font(.largeTitle); Text("Mocha 桌游").font(.title2.bold()); Text("牌桌信息已隐藏").font(.caption) }.foregroundStyle(TableTheme.gold)
            }
        }
        .foregroundStyle(TableTheme.cream).tint(TableTheme.gold).preferredColorScheme(.dark)
        .alert("桌游小提示", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
            Button("知道了", role: .cancel) { store.error = nil }
        } message: { Text(store.error ?? "") }
        .onChange(of: scenePhase) { _, phase in if phase == .active { store.foreground() } }
    }
}

struct ProfileView: View {
    @ObservedObject var store: TableStore
    var editing: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var avatar = "🦊"
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack { Eyebrow(text: "TABLETOP / TONIGHT"); Spacer(); if editing { Button("完成") { dismiss() } } }
                    .padding(.top, 24)
                VStack(alignment: .leading, spacing: 12) {
                    Text(editing ? "换个心情，\n继续开局。" : "今晚，\n一起开一局。")
                        .font(.system(size: 40, weight: .bold, design: .rounded)).tracking(-1)
                    Text("一张桌子，一群朋友。\n不用注册，选一个大家认识的你。")
                        .font(.body).foregroundStyle(TableTheme.muted).lineSpacing(5)
                }
                HStack { Spacer(); AvatarView(value: avatar, size: 104); Spacer() }.padding(.vertical, 5)
                VStack(alignment: .leading, spacing: 12) {
                    Eyebrow(text: "你的名字")
                    TextField("朋友们怎么称呼你？", text: $name)
                        .textFieldStyle(.plain).padding(18).background(TableTheme.surface, in: RoundedRectangle(cornerRadius: 16))
                        .onChange(of: name) { _, value in name = String(value.prefix(16)) }
                    Text("只存在这台手机 · 最多 16 个字").font(.caption).foregroundStyle(TableTheme.muted)
                }
                VStack(alignment: .leading, spacing: 14) {
                    Eyebrow(text: "选个头像")
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 10)], spacing: 12) {
                        ForEach(ProfileCatalog.avatars, id: \.self) { value in
                            Button { avatar = value } label: {
                                Text(value).font(.title2).frame(maxWidth: .infinity).frame(height: 40)
                                    .background(avatar == value ? TableTheme.gold.opacity(0.2) : .clear, in: RoundedRectangle(cornerRadius: 12))
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(avatar == value ? TableTheme.gold : .clear, lineWidth: 1))
                            }.buttonStyle(.plain).accessibilityLabel("选择头像 \(value)")
                        }
                    }
                }
                Button(editing ? "保存资料" : "入座，开始今晚") {
                    store.saveProfile(name: name, avatar: avatar)
                    if store.profile != nil { store.browse(); if editing { dismiss() } }
                }.buttonStyle(PrimaryButton()).disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                HStack(spacing: 8) { Image(systemName: "wifi"); Text("同一 Wi-Fi 或热点，即可发现彼此") }.font(.caption).foregroundStyle(TableTheme.muted).frame(maxWidth: .infinity)
            }.padding(24).frame(maxWidth: 580)
        }
        .background(TableTheme.background)
        .onAppear { name = store.profile?.name ?? ""; avatar = store.profile?.avatar ?? "🦊" }
    }
}

struct HomeView: View {
    @ObservedObject var store: TableStore
    @State private var editing = false
    @State private var selected: GameKind = .gems
    @State private var showGuide = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) { Eyebrow(text: "TABLETOP / TONIGHT"); Text("今晚玩什么？").font(.system(size: 30, weight: .bold, design: .rounded)) }
                    Spacer()
                    Button { editing = true } label: { AvatarView(value: store.profile?.avatar ?? "🦊", size: 48) }.buttonStyle(.plain).accessibilityLabel("编辑昵称与头像")
                }.padding(.top, 12)
                ZStack(alignment: .leading) {
                    GeometryReader { geometry in
                        Artwork.eveningTable.resizable().scaledToFill()
                            .frame(width: geometry.size.width, height: geometry.size.height).clipped()
                    }
                    LinearGradient(colors: [TableTheme.background.opacity(0.5), .clear], startPoint: .leading, endPoint: .trailing)
                    VStack(alignment: .leading, spacing: 13) {
                        Text("好朋友，就在身边").font(.caption.weight(.medium)).foregroundStyle(TableTheme.gold)
                        Text("今晚，\n一起开一局。")
                            .font(.system(size: 26, weight: .bold, design: .rounded)).lineSpacing(5)
                        Text("面对面，才好玩。")
                            .font(.caption).foregroundStyle(TableTheme.cream.opacity(0.75))
                    }.padding(22)
                }.frame(height: 200).clipShape(RoundedRectangle(cornerRadius: 26))
                VStack(alignment: .leading, spacing: 14) {
                    HStack { Eyebrow(text: "01 / 选一款游戏"); Spacer(); Text("4 款桌游").font(.caption).foregroundStyle(TableTheme.muted) }
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(GameKind.allCases) { kind in
                            Button { selected = kind } label: { GameTile(kind: kind, selected: selected == kind) }.buttonStyle(.plain)
                        }
                    }
                    Button { store.createRoom(selected) } label: { HStack { Image(systemName: "plus.circle.fill"); Text("创建\(selected.title)房间"); Spacer(); Image(systemName: "arrow.up.right") }.padding(.horizontal, 18) }
                        .buttonStyle(PrimaryButton(color: TableTheme.accent(selected)))
                    Button { showGuide = true } label: { Label("查看\(selected.title)玩法", systemImage: "book.closed") }.buttonStyle(.plain).font(.caption).frame(maxWidth: .infinity)
                }
                VStack(alignment: .leading, spacing: 14) {
                    HStack { Eyebrow(text: "02 / 加入附近的房间"); Spacer(); Button { store.browse() } label: { Image(systemName: "arrow.clockwise") }.buttonStyle(.plain).accessibilityLabel("刷新附近房间") }
                    if store.nearby.isEmpty {
                        Panel {
                            HStack(spacing: 16) {
                                Image(systemName: "dot.radiowaves.left.and.right").font(.title2).foregroundStyle(TableTheme.muted)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text("等朋友开个房间").font(.subheadline.weight(.semibold))
                                    Text("连接同一 Wi-Fi，并允许本地网络权限。").font(.caption).foregroundStyle(TableTheme.muted)
                                }
                            }
                        }
                    } else {
                        ForEach(store.nearby) { room in
                            Button { store.join(room) } label: {
                                Panel { HStack { Image(systemName: "wifi").foregroundStyle(TableTheme.gold); Text(room.name).font(.subheadline.weight(.medium)); Spacer(); Image(systemName: "arrow.right") } }
                            }.buttonStyle(.plain).disabled(store.connecting)
                        }
                    }
                    if store.connecting { HStack { ProgressView(); Text(store.status).font(.caption); Spacer(); Button("取消") { store.leave() } } }
                }
                Text("欢迎回来，\(store.profile?.name ?? "朋友")。房主请保持应用在前台。")
                    .font(.caption2).foregroundStyle(TableTheme.muted).frame(maxWidth: .infinity).padding(.bottom, 20)
            }.padding(22).frame(maxWidth: 680)
        }.onAppear { store.browse() }
            .sheet(isPresented: $editing) { ProfileView(store: store, editing: true).preferredColorScheme(.dark) }
            .sheet(isPresented: $showGuide) { RulesView(kind: selected) }
    }
}

struct GameTile: View {
    let kind: GameKind
    var selected: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack { Image(systemName: kind.symbol).font(.system(size: 26)).foregroundStyle(TableTheme.accent(kind)); Spacer(); if selected { Image(systemName: "checkmark.circle.fill").foregroundStyle(TableTheme.accent(kind)) } }
            VStack(alignment: .leading, spacing: 5) {
                Text(kind.title).font(.system(.title3, design: .rounded).weight(.bold)).foregroundStyle(TableTheme.cream)
                Text(kind.playerRange.lowerBound == kind.playerRange.upperBound ? "\(kind.playerRange.lowerBound) 人" : "\(kind.playerRange.lowerBound)–\(kind.playerRange.upperBound) 人")
                    .font(.caption).foregroundStyle(TableTheme.muted)
            }
        }.padding(18).frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? TableTheme.accent(kind).opacity(0.10) : TableTheme.surface, in: RoundedRectangle(cornerRadius: 21))
            .overlay(RoundedRectangle(cornerRadius: 21).stroke(selected ? TableTheme.accent(kind).opacity(0.7) : .white.opacity(0.05), lineWidth: 1))
            .accessibilityLabel("\(kind.title)，\(kind.playerRange.lowerBound)到\(kind.playerRange.upperBound)人\(selected ? "，已选择" : "")")
    }
}
