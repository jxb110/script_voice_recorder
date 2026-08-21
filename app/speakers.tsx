import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAppLanguage } from "@/lib/i18n";
import { useRecorder } from "@/lib/recorder-context";
import type { Gender, Speaker } from "@/shared/recorder-types";

const emptyDraft = { name: "", gender: "女" as Gender, age: 25 };

export default function SpeakersScreen() {
  const router = useRouter();
  const { language } = useAppLanguage();
  const { speakers, projects, createSpeaker, updateSpeaker, deleteSpeaker } = useRecorder();
  const copy = language === "zh" ? { unnamed: "未命名发音人", unableDelete: "无法删除发音人", linkedHint: (name: string, count: number) => `“${name}”仍关联 ${count} 个录音任务。请先删除或更换这些任务。`, deleteTitle: "删除发音人？", deleteHint: (name: string) => `将删除“${name}”的个人信息。`, cancel: "取消", delete: "删除", retry: "请稍后重试。", back: "返回上一页", title: "发音人", subtitle: "保存身份信息，方便归档与切换", add: "新建发音人", years: "岁", emptyTitle: "先创建发音人", emptyHint: "录音任务会绑定名称、性别和年龄，并以此作为文件夹信息。", create: "填写发音人信息", listBack: "返回发音人列表", edit: "编辑发音人", close: "关闭", name: "名称", namePlaceholder: "例如：王小明", gender: "性别", age: "年龄", save: "保存发音人" } : { unnamed: "Unnamed speaker", unableDelete: "Cannot delete speaker", linkedHint: (name: string, count: number) => `“${name}” is still linked to ${count} recording task(s). Delete or change those tasks first.`, deleteTitle: "Delete speaker?", deleteHint: (name: string) => `Personal information for “${name}” will be deleted.`, cancel: "Cancel", delete: "Delete", retry: "Please try again later.", back: "Back", title: "Speakers", subtitle: "Save identity details for archiving and switching", add: "Add speaker", years: "years", emptyTitle: "Create a speaker first", emptyHint: "Recording tasks are linked to a name, gender, and age, which are also used for folders.", create: "Enter speaker details", listBack: "Back to speakers", edit: "Edit speaker", close: "Close", name: "Name", namePlaceholder: "e.g. Alex Chen", gender: "Gender", age: "Age", save: "Save speaker" };
  const genderLabel = (gender: Gender) => language === "zh" ? gender : gender === "女" ? "Female" : gender === "男" ? "Male" : "Other";
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const close = () => { setEditing(null); setIsCreating(false); setDraft(emptyDraft); };
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace("/" as never); };
  const openNew = () => { setDraft(emptyDraft); setIsCreating(true); };
  const openEdit = (speaker: Speaker) => { setDraft({ name: speaker.name, gender: speaker.gender, age: speaker.age }); setEditing(speaker); };
  const save = () => {
    const input = { name: draft.name.trim() || copy.unnamed, gender: draft.gender, age: Math.max(1, Math.min(120, Number(draft.age) || 1)) };
    if (editing) updateSpeaker(editing.id, input); else createSpeaker(input);
    close();
  };
  const confirmDelete = (speaker: Speaker) => {
    const linked = projects.filter((project) => project.speakerId === speaker.id).length;
    if (linked) { Alert.alert(copy.unableDelete, copy.linkedHint(speaker.name, linked)); return; }
    Alert.alert(copy.deleteTitle, copy.deleteHint(speaker.name), [{ text: copy.cancel, style: "cancel" }, { text: copy.delete, style: "destructive", onPress: () => { try { deleteSpeaker(speaker.id); close(); } catch (error) { Alert.alert(copy.unableDelete, error instanceof Error ? error.message : copy.retry); } } }]);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={goBack} accessibilityLabel={copy.back}><MaterialIcons color="#2F4DA0" name="arrow-back" size={24} /></TouchableOpacity>
        <View style={styles.titleBlock}><Text style={styles.title}>{copy.title}</Text><Text style={styles.subtitle}>{copy.subtitle}</Text></View>
        <TouchableOpacity style={styles.add} onPress={openNew} accessibilityLabel={copy.add}><MaterialIcons color="#FFFFFF" name="person-add" size={21} /></TouchableOpacity>
      </View>
      <FlatList
        data={speakers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={speakers.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => <View style={styles.speakerCard}><TouchableOpacity style={styles.speakerMain} onPress={() => openEdit(item)}><View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 1)}</Text></View><View style={styles.speakerBody}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{genderLabel(item.gender)} · {item.age} {copy.years}</Text></View><MaterialIcons color="#9AA5BC" name="edit" size={20} /></TouchableOpacity><TouchableOpacity style={styles.delete} onPress={() => confirmDelete(item)} accessibilityLabel={`${copy.delete} ${item.name}`}><MaterialIcons color="#C34F5A" name="delete-outline" size={20} /></TouchableOpacity></View>}
        ListEmptyComponent={<View style={styles.empty}><MaterialIcons color="#A9B2C7" name="record-voice-over" size={45} /><Text style={styles.emptyTitle}>{copy.emptyTitle}</Text><Text style={styles.emptyText}>{copy.emptyHint}</Text><TouchableOpacity style={styles.primary} onPress={openNew}><Text style={styles.primaryText}>{copy.create}</Text></TouchableOpacity></View>}
      />
      <Modal visible={isCreating || Boolean(editing)} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.overlay}><View style={styles.sheet}>
          <View style={styles.sheetHeader}><TouchableOpacity style={styles.sheetBack} onPress={close} accessibilityLabel={copy.listBack}><MaterialIcons color="#2F4DA0" name="arrow-back" size={23} /></TouchableOpacity><Text style={styles.sheetTitle}>{editing ? copy.edit : copy.create}</Text><TouchableOpacity style={styles.sheetBack} onPress={close} accessibilityLabel={copy.close}><MaterialIcons color="#65708A" name="close" size={23} /></TouchableOpacity></View>
          <Text style={styles.label}>{copy.name}</Text><TextInput autoFocus value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder={copy.namePlaceholder} placeholderTextColor="#9AA5BC" style={styles.input} returnKeyType="done" />
          <Text style={styles.label}>{copy.gender}</Text><View style={styles.genders}>{(["女", "男", "其他"] as Gender[]).map((gender) => <TouchableOpacity key={gender} style={[styles.gender, draft.gender === gender && styles.genderActive]} onPress={() => setDraft((current) => ({ ...current, gender }))}><Text style={[styles.genderText, draft.gender === gender && styles.genderTextActive]}>{genderLabel(gender)}</Text></TouchableOpacity>)}</View>
          <Text style={styles.label}>{copy.age}</Text><TextInput value={String(draft.age)} onChangeText={(age) => setDraft((current) => ({ ...current, age: Number(age.replace(/[^0-9]/g, "")) || 0 }))} keyboardType="number-pad" style={styles.input} />
          <TouchableOpacity style={styles.save} onPress={save}><Text style={styles.saveText}>{copy.save}</Text></TouchableOpacity>
          {editing ? <TouchableOpacity style={styles.deleteSheet} onPress={() => confirmDelete(editing)}><MaterialIcons color="#C34F5A" name="delete-outline" size={19} /><Text style={styles.deleteSheetText}>{copy.delete}</Text></TouchableOpacity> : null}
        </View></View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 22, paddingTop: 10 }, back: { alignItems: "center", height: 44, justifyContent: "center", width: 44 }, titleBlock: { flex: 1, marginLeft: 5 }, title: { color: "#182033", fontSize: 28, fontWeight: "800" }, subtitle: { color: "#65708A", fontSize: 13, marginTop: 4 }, add: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 16, height: 44, justifyContent: "center", width: 44 }, list: { gap: 12, paddingBottom: 20 }, emptyList: { flexGrow: 1, justifyContent: "center", paddingBottom: 70 }, speakerCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#E4E8F0", borderRadius: 18, borderWidth: 1, flexDirection: "row", overflow: "hidden" }, speakerMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: 13, padding: 15 }, delete: { alignItems: "center", alignSelf: "stretch", borderLeftColor: "#EDF0F5", borderLeftWidth: 1, justifyContent: "center", width: 48 }, avatar: { alignItems: "center", backgroundColor: "#EEE9FF", borderRadius: 17, height: 48, justifyContent: "center", width: 48 }, avatarText: { color: "#6651A8", fontSize: 19, fontWeight: "800" }, speakerBody: { flex: 1 }, name: { color: "#182033", fontSize: 16, fontWeight: "800" }, meta: { color: "#65708A", fontSize: 13, marginTop: 5 }, empty: { alignItems: "center", paddingHorizontal: 27 }, emptyTitle: { color: "#182033", fontSize: 19, fontWeight: "800", marginTop: 15 }, emptyText: { color: "#65708A", fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: "center" }, primary: { backgroundColor: "#2F4DA0", borderRadius: 14, marginTop: 22, paddingHorizontal: 21, paddingVertical: 13 }, primaryText: { color: "#FFFFFF", fontWeight: "800" }, overlay: { backgroundColor: "rgba(24,32,51,0.38)", flex: 1, justifyContent: "flex-end" }, sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 22, paddingBottom: 32 }, sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }, sheetBack: { alignItems: "center", height: 34, justifyContent: "center", width: 34 }, sheetTitle: { color: "#182033", fontSize: 20, fontWeight: "800" }, label: { color: "#3F4A62", fontSize: 14, fontWeight: "800", marginBottom: 8, marginTop: 14 }, input: { backgroundColor: "#F2F4F8", borderRadius: 12, color: "#182033", fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 }, genders: { flexDirection: "row", gap: 8 }, gender: { alignItems: "center", backgroundColor: "#F2F4F8", borderRadius: 11, flex: 1, paddingVertical: 12 }, genderActive: { backgroundColor: "#E7EEFF", borderColor: "#2F4DA0", borderWidth: 1 }, genderText: { color: "#65708A", fontWeight: "700" }, genderTextActive: { color: "#2F4DA0" }, save: { alignItems: "center", backgroundColor: "#2F4DA0", borderRadius: 15, marginTop: 26, paddingVertical: 16 }, saveText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" }, deleteSheet: { alignItems: "center", flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 16, paddingVertical: 10 }, deleteSheetText: { color: "#C34F5A", fontSize: 14, fontWeight: "800" },
});
