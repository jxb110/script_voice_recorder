import { StyleSheet, Text, View } from "react-native";

export function SettingsFooter({ versionLabel, version }: { versionLabel: string; version: string }) {
  return (
    <View style={styles.footer} accessibilityLabel={`${versionLabel} ${version}. Powered by 基因不投降`}>
      <Text style={styles.version}>{versionLabel} {version}</Text>
      <Text style={styles.poweredBy}>Powered by 基因不投降</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: "center", marginTop: 28, paddingBottom: 8 },
  version: { color: "#8A95AA", fontSize: 12, fontVariant: ["tabular-nums"] },
  poweredBy: { color: "#65708A", fontSize: 12, fontWeight: "700", marginTop: 6 },
});
