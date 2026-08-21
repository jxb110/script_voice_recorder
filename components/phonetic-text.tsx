import { StyleSheet, Text, View } from "react-native";

import { pinyinFontSizeForReadingFont } from "@/lib/reading-font";
import type { ScriptToken } from "@/shared/recorder-types";

export function PhoneticText({ tokens, fontSize = 29 }: { tokens: ScriptToken[]; fontSize?: number }) {
  const pinyinFontSize = pinyinFontSizeForReadingFont(fontSize);
  const characterLineHeight = Math.round(fontSize * 1.35);
  return (
    <View style={styles.line} accessibilityLabel={tokens.map((token) => token.char).join("")}>
      {tokens.map((token, index) => (
        <View key={`${token.char}-${index}`} style={styles.token}>
          <Text style={[styles.pinyin, { fontSize: pinyinFontSize, lineHeight: pinyinFontSize + 5, minHeight: pinyinFontSize + 5 }]}>{token.pinyin ?? " "}</Text>
          <Text style={[styles.character, { fontSize, lineHeight: characterLineHeight }]}>{token.char}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 10 },
  token: { alignItems: "center", flexGrow: 0, flexShrink: 0, justifyContent: "flex-end", minWidth: 32, paddingHorizontal: 2 },
  pinyin: { color: "#65708A", includeFontPadding: false, textAlign: "center" },
  character: { color: "#182033", fontWeight: "700", includeFontPadding: false, textAlign: "center" },
});
