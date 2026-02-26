import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated, Easing, Modal, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/ThemeContext';
import { askChatbot } from '../services/chatbot';

const CHAT_HISTORY_KEY = 'tracksure_chat_history';
const MAX_HISTORY_SESSIONS = 30;

const SUGGESTIONS = [
  'Which order has the highest distance?',
  'How many orders are delivered?',
  'Show all pending orders',
  'List all drivers',
  'Show bike deliveries',
  'Orders in progress right now',
];

const WELCOME_MSG = {
  id: '0',
  role: 'bot',
  text: "Hi! I'm TrackSure AI 🚚\n\nI can answer questions about your deliveries, drivers, and orders. Try asking me something below or tap a suggestion!",
  hasData: false,
  recordCount: 0,
};

// ── Chat history helpers ───────────────────────────────────────────────────
async function loadChatHistory() {
  try {
    const raw = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveChatSession(session) {
  try {
    const all = await loadChatHistory();
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) all[idx] = session;
    else all.unshift(session);
    await AsyncStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify(all.slice(0, MAX_HISTORY_SESSIONS))
    );
  } catch {}
}

async function deleteChatSession(id) {
  try {
    const all = await loadChatHistory();
    await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(all.filter(s => s.id !== id)));
  } catch {}
}

function formatDate(ts) {
  const d = new Date(ts);
  const diffDays = Math.floor((Date.now() - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Rich-text renderer ─────────────────────────────────────────────────────
// Converts plain-text Gemini responses into structured React Native elements.
// Handles: section headings, numbered lists, dash bullets, key:value pairs, paragraphs.
function FormattedText({ text, theme }) {
  if (!text) return null;

  // Strip any residual markdown asterisks just in case
  const cleaned = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
  const lines = cleaned.split('\n');
  const elements = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<View key={`sp-${i}`} style={{ height: 5 }} />);
      return;
    }

    // Numbered list: "1. text" or "1) text"
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      elements.push(
        <View key={`n-${i}`} style={styles.listRow}>
          <View style={[styles.numBadge, { backgroundColor: theme.primaryBlue }]}>
            <Text style={styles.numBadgeText}>{numMatch[1]}</Text>
          </View>
          <Text style={[styles.listText, { color: theme.textPrimary }]}>{numMatch[2]}</Text>
        </View>
      );
      return;
    }

    // Dash / bullet: "- text" or "• text"
    const bulletMatch = trimmed.match(/^[-•]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <View key={`b-${i}`} style={styles.listRow}>
          <View style={[styles.bullet, { backgroundColor: theme.primaryBlue }]} />
          <Text style={[styles.listText, { color: theme.textPrimary }]}>{bulletMatch[1]}</Text>
        </View>
      );
      return;
    }

    // Section heading: line ends with ":" and nothing else
    if (/^[^:]+:$/.test(trimmed)) {
      elements.push(
        <Text key={`h-${i}`} style={[styles.sectionHeading, { color: theme.primaryBlue }]}>
          {trimmed.slice(0, -1)}
        </Text>
      );
      return;
    }

    // Key-value: "Label: value" — label is a word/phrase before first colon
    const kvMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9 /()#-]{1,30}):\s+(.+)/);
    if (kvMatch) {
      elements.push(
        <View key={`kv-${i}`} style={styles.kvRow}>
          <Text style={[styles.kvLabel, { color: theme.textSecondary }]}>{kvMatch[1]}:</Text>
          <Text style={[styles.kvValue, { color: theme.textPrimary }]}>{kvMatch[2]}</Text>
        </View>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <Text key={`p-${i}`} style={[styles.paraText, { color: theme.textPrimary }]}>
        {trimmed}
      </Text>
    );
  });

  return <View>{elements}</View>;
}

// ── Typing indicator ──────────────────────────────────────────────────────
function TypingIndicator({ theme }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={[styles.botBubble, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <Text style={styles.botAvatar}>🤖</Text>
      <View style={styles.typingDots}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: theme.primaryBlue,
                opacity: dot,
                transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────
function MessageBubble({ msg, theme }) {
  if (msg.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={[styles.userBubble, { backgroundColor: theme.primaryBlueLight }]}>
          <Text style={[styles.userText, { color: theme.white }]}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.botRow}>
      <Text style={styles.botAvatar}>🤖</Text>
      <View style={[styles.botCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        {msg.hasData && (
          <View style={[styles.dataBadge, { backgroundColor: theme.primaryBlue + '18' }]}>
            <Text style={[styles.dataBadgeText, { color: theme.primaryBlue }]}>
              📊 {msg.recordCount} record{msg.recordCount !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}
        <FormattedText text={msg.text} theme={theme} />
      </View>
    </View>
  );
}

// ── History modal ─────────────────────────────────────────────────────────
function HistoryModal({ visible, onClose, onLoad, onNew, theme }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadChatHistory().then(s => { setSessions(s); setLoading(false); });
    }
  }, [visible]);

  const handleDelete = (id) => {
    Alert.alert('Delete chat', 'Remove this conversation from history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteChatSession(id);
          setSessions(prev => prev.filter(s => s.id !== id));
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.background }]}>
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Text style={[styles.modalCloseText, { color: theme.textSecondary }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Chat History</Text>
            <TouchableOpacity
              style={[styles.newChatBtn, { backgroundColor: theme.primaryBlue }]}
              onPress={() => { onNew(); onClose(); }}
              activeOpacity={0.8}
            >
              <Text style={styles.newChatText}>+ New</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={theme.primaryBlue} size="large" />
          ) : sessions.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryEmoji}>💬</Text>
              <Text style={[styles.emptyHistoryText, { color: theme.textSecondary }]}>
                No saved chats yet.{'\n'}Start a conversation!
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
              {sessions.map(session => (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.historyItem, { borderBottomColor: theme.border }]}
                  onPress={() => { onLoad(session); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.historyIcon, { backgroundColor: theme.primaryBlue + '20' }]}>
                    <Text style={{ fontSize: 18 }}>💬</Text>
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                      {session.title}
                    </Text>
                    <Text style={[styles.historyMeta, { color: theme.textSecondary }]}>
                      {session.messages.filter(m => m.id !== '0').length} message
                      {session.messages.filter(m => m.id !== '0').length !== 1 ? 's' : ''}
                      {' · '}{formatDate(session.timestamp)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(session.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={[styles.deleteBtnText, { color: theme.error || '#EF4444' }]}>🗑</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ChatbotScreen({ navigation }) {
  const { theme } = useTheme();

  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const flatListRef = useRef(null);
  const sessionStarted = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
  }, [messages, isTyping]);

  // Persist session whenever messages update
  useEffect(() => {
    if (!sessionStarted.current || messages.length <= 1) return;
    const title = messages.find(m => m.role === 'user' && m.id !== '0')?.text?.slice(0, 60) || 'Conversation';
    saveChatSession({ id: sessionId, title, timestamp: Date.now(), messages });
  }, [messages, sessionId]);

  const startNewChat = useCallback(() => {
    setSessionId(Date.now().toString());
    setMessages([WELCOME_MSG]);
    setInput('');
    sessionStarted.current = false;
  }, []);

  const loadSession = useCallback((session) => {
    setSessionId(session.id);
    setMessages(session.messages);
    sessionStarted.current = true;
  }, []);

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || isTyping) return;

    sessionStarted.current = true;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user', text: trimmed,
      hasData: false, recordCount: 0,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const history = messages
      .filter(m => m.id !== '0')
      .map(m => ({ role: m.role, text: m.text }));

    try {
      const result = await askChatbot(trimmed, history);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: result.text,
          hasData: result.hasData,
          recordCount: result.recordCount,
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: `Sorry, I ran into an error: ${err.message}\n\nPlease check your connection and try again.`,
          hasData: false, recordCount: 0,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const showSuggestions = messages.length <= 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primaryBlue }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: theme.white }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.white }]}>AI Assistant</Text>
          <View style={styles.headerSubRow}>
            <View style={styles.onlineDot} />
            <Text style={[styles.headerSub, { color: theme.white }]}>Powered by Gemini</Text>
          </View>
        </View>
        {/* History button */}
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => setShowHistory(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.headerIconEmoji}>🕐</Text>
        </TouchableOpacity>
        {/* New chat button */}
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={startNewChat}
          activeOpacity={0.7}
        >
          <Text style={styles.headerIconEmoji}>✏️</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <MessageBubble msg={item} theme={theme} />}
          ListFooterComponent={
            <>
              {isTyping && <TypingIndicator theme={theme} />}
              {showSuggestions && !isTyping && (
                <View style={styles.suggestionsWrapper}>
                  <Text style={[styles.suggestionsLabel, { color: theme.textSecondary }]}>Try asking:</Text>
                  <View style={styles.chips}>
                    {SUGGESTIONS.map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.chip, { backgroundColor: theme.cardBackground, borderColor: theme.primaryBlue + '55' }]}
                        onPress={() => send(s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: theme.primaryBlue }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.background, color: theme.textPrimary }]}
            placeholder="Ask about orders, drivers, deliveries..."
            placeholderTextColor={theme.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => send()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() && !isTyping ? theme.primaryBlue : theme.border },
            ]}
            onPress={() => send()}
            disabled={!input.trim() || isTyping}
            activeOpacity={0.8}
          >
            {isTyping
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.sendIcon}>➤</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <HistoryModal
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        onLoad={loadSession}
        onNew={startNewChat}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 14, paddingHorizontal: 16, gap: 10,
  },
  backBtn: { padding: 4 },
  backArrow: { fontSize: 26, fontWeight: 'bold' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  headerSub: { fontSize: 11, opacity: 0.85 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerIconEmoji: { fontSize: 18 },

  // ── Messages ──
  messageList: { padding: 16, paddingBottom: 8 },

  userRow: { alignItems: 'flex-end', marginBottom: 12 },
  userBubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18, borderBottomRightRadius: 4,
  },
  userText: { fontSize: 15, lineHeight: 21 },

  botRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  botAvatar: { fontSize: 24, marginTop: 2 },
  botCard: {
    flex: 1, borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 14, borderWidth: 1,
  },
  dataBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, marginBottom: 10,
  },
  dataBadgeText: { fontSize: 12, fontWeight: '600' },

  // ── Formatted text ──
  paraText: { fontSize: 15, lineHeight: 23, marginBottom: 2 },
  sectionHeading: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4, letterSpacing: 0.2 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bullet: { width: 7, height: 7, borderRadius: 4, marginTop: 7, marginRight: 9, flexShrink: 0 },
  numBadge: {
    width: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8, marginTop: 2, flexShrink: 0,
  },
  numBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  listText: { flex: 1, fontSize: 15, lineHeight: 22 },
  kvRow: { flexDirection: 'row', marginBottom: 5, flexWrap: 'wrap', alignItems: 'flex-start' },
  kvLabel: { fontSize: 13, fontWeight: '600', marginRight: 5 },
  kvValue: { fontSize: 13, lineHeight: 20, flex: 1 },

  // ── Typing indicator ──
  botBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', borderRadius: 18, borderBottomLeftRadius: 4,
    padding: 12, marginBottom: 12, borderWidth: 1,
  },
  typingDots: { flexDirection: 'row', gap: 5, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  // ── Suggestion chips ──
  suggestionsWrapper: { marginTop: 8, marginBottom: 12 },
  suggestionsLabel: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontWeight: '500' },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    borderTopWidth: 1, gap: 8,
  },
  textInput: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  sendIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },

  // ── History modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', minHeight: 300, paddingTop: 8,
  },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  modalCloseBtn: { padding: 4, marginRight: 8 },
  modalCloseText: { fontSize: 18 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  newChatBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  newChatText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  historyIcon: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  historyMeta: { fontSize: 12 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18 },

  emptyHistory: { alignItems: 'center', paddingTop: 52, paddingBottom: 32 },
  emptyHistoryEmoji: { fontSize: 52, marginBottom: 16 },
  emptyHistoryText: { fontSize: 15, textAlign: 'center', lineHeight: 24 },
});
