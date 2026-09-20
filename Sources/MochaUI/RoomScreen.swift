import SwiftUI
import MochaCore

struct RoomScreen: View {
    @ObservedObject var store: TableStore
    let room: RoomSnapshot
    @State private var leaving = false
    @State private var ending = false
    @State private var guide = false
    @State private var prompt: ActionPrompt?
    @State private var showMembers = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Button { leaving = true } label: { Image(systemName: "arrow.left").frame(width: 40, height: 40).background(TableTheme.surface, in: Circle()) }.buttonStyle(.plain).accessibilityLabel("离开房间")
                    VStack(alignment: .leading, spacing: 4) { Eyebrow(text: "\(room.gameKind.title) / \(room.game == nil ? "LOBBY" : "PLAYING")"); Text(room.name).font(.headline) }
                    Spacer()
                    Button { guide = true } label: { Image(systemName: "questionmark.circle").font(.title3) }.buttonStyle(.plain).accessibilityLabel("查看游戏规则")
                }.padding(.top, 8)
                if store.reconnecting || room.paused {
                    Panel { Label(store.reconnecting ? "正在重连房主…请保持应用打开。" : "等待掉线玩家重新连接，牌局已暂停。", systemImage: "wifi.exclamationmark").font(.subheadline).foregroundStyle(TableTheme.gold) }
                }
                if let game = room.game {
                    gameBoard(game)
                } else {
                    lobby
                }
                if room.game != nil {
                    DisclosureGroup(isExpanded: $showMembers) { members } label: { Text("本局玩家 · \(room.members.count) 人").font(.subheadline).foregroundStyle(TableTheme.muted) }
                    if store.isHost {
                        Button(room.game?.isFinished == true ? "再来一局 · 返回房间" : "结束本局并返回房间") {
                            if room.game?.isFinished == true { store.send(.returnToLobby) } else { ending = true }
                        }.font(.subheadline).foregroundStyle(TableTheme.muted).frame(maxWidth: .infinity).padding(.top, 6)
                    }
                }
            }.padding(22).padding(.bottom, 28).frame(maxWidth: 720)
        }
        .confirmationDialog(store.isHost ? "离开会关闭房间，所有玩家将断开连接。" : "离开后，你可以用同一台手机重新加入。", isPresented: $leaving, titleVisibility: .visible) {
            Button(store.isHost ? "关闭房间并离开" : "离开房间", role: .destructive) { store.leave() }
            Button("留下继续", role: .cancel) {}
        }
        .confirmationDialog("结束当前牌局？本局进度将清除。", isPresented: $ending, titleVisibility: .visible) {
            Button("结束本局", role: .destructive) { store.send(.returnToLobby) }
            Button("继续游戏", role: .cancel) {}
        }
        .sheet(isPresented: $guide) { RulesView(kind: room.gameKind) }
        .sheet(item: $prompt) { action in ActionSheet(prompt: action, accent: TableTheme.accent(room.gameKind)) { command in store.send(.play(command)) } }
        .onChange(of: room.game?.actions) { _, actions in
            if let current = prompt, actions?.contains(current) != true { prompt = nil }
        }
        .onChange(of: room.game?.phase) { _, _ in prompt = nil }
        .onChange(of: room.paused || store.reconnecting) { _, paused in if paused { prompt = nil } }
    }

    private var lobby: some View {
        VStack(alignment: .leading, spacing: 22) {
            Panel {
                HStack(alignment: .top, spacing: 18) {
                    Image(systemName: room.gameKind.symbol).font(.system(size: 38)).foregroundStyle(TableTheme.accent(room.gameKind)).padding(.top, 4)
                    VStack(alignment: .leading, spacing: 7) {
                        Text("座位留好了，\n就等你们。 ").font(.system(size: 26, weight: .bold, design: .rounded))
                        Text(room.gameKind.subtitle).font(.caption).foregroundStyle(TableTheme.muted)
                    }
                }
            }
            if store.isHost {
                Menu {
                    ForEach(GameKind.allCases) { kind in Button(kind.title) { store.send(.selectGame(kind)) } }
                } label: { HStack { Text("当前游戏").foregroundStyle(TableTheme.muted); Spacer(); Text(room.gameKind.title); Image(systemName: "chevron.down") }.font(.subheadline).padding(.horizontal, 4) }
            }
            HStack { Eyebrow(text: "已经入座"); Spacer(); Text("\(room.members.count) / \(room.gameKind.playerRange.upperBound) 人").font(.caption).foregroundStyle(TableTheme.muted) }
            members
            if store.isHost {
                if !store.hostingReady { Label("正在发布房间到局域网…", systemImage: "antenna.radiowaves.left.and.right").font(.caption).foregroundStyle(TableTheme.gold) }
                Button("大家到齐，开局") { store.send(.start) }.buttonStyle(PrimaryButton(color: TableTheme.accent(room.gameKind))).disabled(!room.canStart || !store.hostingReady)
                Text(startExplanation).font(.caption).foregroundStyle(TableTheme.muted).frame(maxWidth: .infinity, alignment: .center)
            } else {
                let ready = room.members.first(where: { $0.id == store.profile?.id })?.ready == true
                Button(ready ? "已准备 · 点击取消" : "我准备好了") { store.send(.ready(!ready)) }.buttonStyle(PrimaryButton(color: TableTheme.accent(room.gameKind))).disabled(store.reconnecting)
            }
            Panel {
                VStack(alignment: .leading, spacing: 8) {
                    Label("让朋友找到这个房间", systemImage: "wifi").font(.subheadline.weight(.semibold))
                    Text("所有手机连接同一个 Wi-Fi 或热点，在首页“附近的房间”中加入。请保持应用打开。若发现不到，请检查本地网络权限或更换网络。").font(.caption).foregroundStyle(TableTheme.muted).lineSpacing(4)
                }
            }
        }
    }

    private var startExplanation: String {
        if !room.gameKind.playerRange.contains(room.members.count) {
            return room.gameKind == .werewolf ? "预女猎守需要正好 12 位玩家。" : "\(room.gameKind.title)支持 \(room.gameKind.playerRange.lowerBound)–\(room.gameKind.playerRange.upperBound) 人。"
        }
        return room.canStart ? "所有人都准备好了，今晚的故事即将开始。" : "等待所有玩家连接并点击“准备”。"
    }

    private var members: some View {
        VStack(spacing: 10) {
            ForEach(Array(room.members.enumerated()), id: \.element.id) { index, member in
                HStack(spacing: 12) {
                    Text(String(format: "%02d", index + 1)).font(.system(.caption, design: .monospaced)).foregroundStyle(TableTheme.muted)
                    AvatarView(value: member.player.avatar, size: 38)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(member.player.name + (member.id == store.profile?.id ? "（我）" : "")).font(.subheadline.weight(.semibold))
                        if member.id == room.hostID { Text("房主").font(.caption2).foregroundStyle(TableTheme.gold) }
                    }
                    Spacer()
                    Text(!member.connected ? "掉线" : room.game != nil ? "在线" : member.ready ? "已准备" : "等准备")
                        .font(.caption).foregroundStyle(member.connected && member.ready ? TableTheme.accent(room.gameKind) : TableTheme.muted)
                    if store.isHost && member.id != room.hostID && room.game == nil {
                        Menu { Button("移出房间", role: .destructive) { store.send(.removePlayer(member.id)) } } label: { Image(systemName: "ellipsis").frame(width: 28, height: 35) }
                    }
                }.padding(12).background(TableTheme.surface, in: RoundedRectangle(cornerRadius: 16))
            }
        }.padding(.top, 4)
    }

    @ViewBuilder private func gameBoard(_ game: GameView) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            if game.isFinished { Label("本局结束", systemImage: "sparkles").font(.caption.weight(.semibold)).foregroundStyle(TableTheme.gold) }
            Text(game.phase).font(.system(size: 28, weight: .bold, design: .rounded))
            Text(game.instruction).font(.subheadline).foregroundStyle(TableTheme.muted).lineSpacing(4)
        }
        if !game.actions.isEmpty && !game.isFinished {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow(text: "轮到你的选择")
                if room.gameKind == .gems {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(game.actions) { action in
                            Button { prompt = action } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "hand.tap.fill").foregroundStyle(TableTheme.accent(.gems))
                                    Text(action.title).font(.subheadline.weight(.semibold)).multilineTextAlignment(.leading)
                                    Spacer(minLength: 0)
                                }.padding(14).frame(maxWidth: .infinity, minHeight: 65, alignment: .leading)
                                    .background(TableTheme.accent(.gems).opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
                            }.buttonStyle(.plain).disabled(room.paused || store.reconnecting)
                        }
                    }
                } else {
                ForEach(game.actions) { action in
                    Button { prompt = action } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "hand.tap.fill").foregroundStyle(TableTheme.accent(room.gameKind))
                            VStack(alignment: .leading, spacing: 5) { Text(action.title).font(.subheadline.weight(.bold)); if !action.help.isEmpty { Text(action.help).font(.caption).foregroundStyle(TableTheme.muted).lineLimit(3) } }
                            Spacer(); Image(systemName: "chevron.right").font(.caption)
                        }.padding(17).background(TableTheme.accent(room.gameKind).opacity(0.10), in: RoundedRectangle(cornerRadius: 18))
                    }.buttonStyle(.plain).disabled(room.paused || store.reconnecting)
                }
                }
            }
        }
        ForEach(game.sections) { section in
            if room.gameKind == .gems && section.id == "bank" {
                GemSupplyView(section: section)
            } else if room.gameKind == .gems && section.id.hasPrefix("market:") {
                GemMarketView(section: section, actions: game.actions) { command in store.send(.play(command)) }
                    .disabled(room.paused || store.reconnecting)
            } else if room.gameKind == .gems && (section.id == "players" || section.id.hasPrefix("collection:")) {
                DisclosureGroup(section.title) { GameSectionView(section: section) }.font(.subheadline).foregroundStyle(TableTheme.muted)
            } else {
                GameSectionView(section: section).id(section.id + (room.game?.phase ?? ""))
            }
        }
        if !game.log.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Eyebrow(text: "牌局记录")
                ForEach(Array(game.log.suffix(12).enumerated()), id: \.offset) { _, entry in
                    HStack(alignment: .top, spacing: 10) { Circle().fill(TableTheme.muted.opacity(0.5)).frame(width: 4, height: 4).padding(.top, 7); Text(entry).font(.caption).foregroundStyle(TableTheme.muted).lineSpacing(3) }
                }
            }
        }
    }
}

struct GameSectionView: View {
    let section: DisplaySection
    @State private var revealed = false
    @Environment(\.scenePhase) private var phase
    var body: some View {
        Panel {
            VStack(alignment: .leading, spacing: 15) {
                HStack {
                    Eyebrow(text: section.title)
                    Spacer()
                    if section.isPrivate { Button { revealed.toggle() } label: { Label(revealed ? "收起" : "查看", systemImage: revealed ? "eye.slash" : "lock.fill") }.font(.caption).foregroundStyle(TableTheme.gold) }
                }
                if !section.isPrivate || revealed {
                    ForEach(section.items) { item in
                        HStack(alignment: .top, spacing: 12) {
                            if !item.symbol.isEmpty {
                                if item.symbol.contains(".") { Image(systemName: item.symbol).font(.title3).foregroundStyle(TableTheme.gold).frame(width: 27) }
                                else { Text(item.symbol).font(.title3).frame(width: 27) }
                            }
                            VStack(alignment: .leading, spacing: 6) {
                                Text(item.title).font(.subheadline.weight(.semibold))
                                if !item.detail.isEmpty { Text(item.detail).font(.caption).foregroundStyle(TableTheme.muted).lineSpacing(4).fixedSize(horizontal: false, vertical: true) }
                            }
                            Spacer(minLength: 0)
                        }
                        if item.id != section.items.last?.id { Divider().overlay(.white.opacity(0.03)) }
                    }
                } else {
                    HStack(spacing: 10) { Image(systemName: "hand.raised.fill"); Text("仅你可见，确认旁边没人偷看再打开。") }.font(.caption).foregroundStyle(TableTheme.muted).padding(.vertical, 10)
                }
            }
        }.privacySensitive(section.isPrivate)
            .onChange(of: phase) { _, value in if value != .active { revealed = false } }
    }
}

struct ActionSheet: View {
    let prompt: ActionPrompt
    let accent: Color
    let submit: (GameCommand) -> Void
    @State private var selection: Set<String> = []
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        VStack(spacing: 0) {
            HStack { Text(prompt.title).font(.title3.weight(.bold)); Spacer(); Button("取消") { dismiss() }.font(.subheadline) }.padding(22)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if !prompt.help.isEmpty { Text(prompt.help).font(.subheadline).foregroundStyle(TableTheme.muted).lineSpacing(4).padding(.bottom, 5) }
                    ForEach(prompt.choices) { choice in
                        Button {
                            if selection.contains(choice.id) { selection.remove(choice.id) }
                            else if prompt.max == 1 { selection = [choice.id] }
                            else if selection.count < prompt.max { selection.insert(choice.id) }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: selection.contains(choice.id) ? "checkmark.circle.fill" : "circle").foregroundStyle(selection.contains(choice.id) ? accent : TableTheme.muted).padding(.top, 2)
                                VStack(alignment: .leading, spacing: 5) { Text(choice.title).font(.subheadline.weight(.semibold)); if !choice.subtitle.isEmpty { Text(choice.subtitle).font(.caption).foregroundStyle(TableTheme.muted).lineSpacing(3) } }
                                Spacer(minLength: 0)
                            }.padding(16).frame(maxWidth: .infinity, alignment: .leading)
                                .background(selection.contains(choice.id) ? accent.opacity(0.12) : TableTheme.surface, in: RoundedRectangle(cornerRadius: 16))
                        }.buttonStyle(.plain)
                    }
                }.padding(.horizontal, 22).padding(.bottom, 20)
            }
            VStack(spacing: 10) {
                if prompt.max > 0 { Text(prompt.min == prompt.max ? "请选择 \(prompt.min) 项 · 已选 \(selection.count)" : "选择 \(prompt.min)–\(prompt.max) 项 · 已选 \(selection.count)").font(.caption).foregroundStyle(TableTheme.muted) }
                Button("确认\(prompt.title)") {
                    let values = prompt.choices.filter { selection.contains($0.id) }.map(\.id)
                    submit(GameCommand(prompt.id, values: values)); dismiss()
                }.buttonStyle(PrimaryButton(color: accent)).disabled(selection.count < prompt.min || selection.count > prompt.max)
            }.padding(22).background(TableTheme.background)
        }.background(TableTheme.background).foregroundStyle(TableTheme.cream).tint(accent).preferredColorScheme(.dark)
            .presentationDetents([.medium, .large]).presentationDragIndicator(.visible)
    }
}
