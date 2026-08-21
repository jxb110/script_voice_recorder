import { StyleSheet, Text, View } from "react-native";

import type { ScriptToken } from "@/shared/recorder-types";

export function PhoneticText({ tokens }: { tokens: ScriptToken[] }) {
  return (
    <View style={styles.line} accessibilityLabel={tokens.map((token) => token.char).join("")}>
      {tokens.map((token, index) => (
        <View key={`${token.char}-${index}`} style={styles.token}>
          <Text style={styles.pinyin}>{token.pinyin ?? " "}</Text>
          <Text style={styles.character}>{token.char}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 8 },
  token: { alignItems: "center", minWidth: 31, paddingHorizontal: 1 },
  pinyin: { color: "#65708A", fontSize: 13, lineHeight: 18, minHeight: 18, textAlign: "center" },
  character: { color: "#182033", fontSize: 29, fontWeight: "700", lineHeight: 39, textAlign: "center" },
});
