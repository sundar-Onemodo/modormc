import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface FollowUp {
  id: string;
  client: string;
  topic: string;
  dueTime: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Normal';
  completed: boolean;
}

export default function FollowUpsScreen() {
  const [filter, setFilter] = useState<'All' | 'Today' | 'Upcoming'>('All');
  const [items, setItems] = useState<FollowUp[]>([
    {
      id: 'FU-101',
      client: 'Brigade Horizon - Site Office',
      topic: 'Confirm pour schedule for Basement Slab 2 (280 m³)',
      dueTime: '11:00 AM',
      dueDate: 'Today',
      priority: 'High',
      completed: false,
    },
    {
      id: 'FU-102',
      client: 'L&T Metro Project Team',
      topic: 'Submit 28-day cube test compressive strength report',
      dueTime: '02:30 PM',
      dueDate: 'Today',
      priority: 'High',
      completed: false,
    },
    {
      id: 'FU-103',
      client: 'Sobha Royal Pavilion',
      topic: 'Discuss pump line pipeline access & boom placer booking',
      dueTime: '10:00 AM',
      dueDate: 'Tomorrow',
      priority: 'Medium',
      completed: false,
    },
    {
      id: 'FU-104',
      client: 'Prestige Sanctuary Phase 1',
      topic: 'Advance billing payment collection & gate pass validation',
      dueTime: '04:00 PM',
      dueDate: 'Tomorrow',
      priority: 'Normal',
      completed: true,
    },
  ]);

  const toggleComplete = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'Today') return item.dueDate === 'Today';
    if (filter === 'Upcoming') return item.dueDate !== 'Today';
    return true;
  });

  const getPriorityStyle = (priority: FollowUp['priority']) => {
    switch (priority) {
      case 'High':
        return { bg: '#FEE2E2', text: '#DC2626' };
      case 'Medium':
        return { bg: '#FEF3C7', text: '#D97706' };
      case 'Normal':
        return { bg: '#EFF6FF', text: '#2563EB' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2A4A" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Follow ups</Text>
        <Text style={styles.headerSubtitle}>Site visits, mix approvals & pour confirmations</Text>
      </View>

      {/* Segmented Filter */}
      <View style={styles.tabContainer}>
        {(['All', 'Today', 'Upcoming'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, filter === tab && styles.tabButtonActive]}
            onPress={() => setFilter(tab)}>
            <Text style={[styles.tabButtonText, filter === tab && styles.tabButtonTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
        {filteredItems.map((item) => {
          const pStyle = getPriorityStyle(item.priority);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, item.completed && styles.cardCompleted]}
              onPress={() => toggleComplete(item.id)}
              activeOpacity={0.85}>
              <View style={styles.cardHeader}>
                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={14} color="#2563EB" />
                  <Text style={styles.timeText}>
                    {item.dueDate} · {item.dueTime}
                  </Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: pStyle.bg }]}>
                  <Text style={[styles.priorityText, { color: pStyle.text }]}>{item.priority}</Text>
                </View>
              </View>

              <Text style={[styles.clientName, item.completed && styles.textCompleted]}>
                {item.client}
              </Text>
              <Text style={[styles.topicText, item.completed && styles.textCompleted]}>
                {item.topic}
              </Text>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleComplete(item.id)}>
                  <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
                    {item.completed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {item.completed ? 'Completed' : 'Tap to mark done'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.actionIcons}>
                  <TouchableOpacity style={styles.iconCircle}>
                    <Ionicons name="call-outline" size={16} color="#2563EB" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconCircle}>
                    <Ionicons name="navigate-outline" size={16} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#0B2A4A',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#2563EB',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 90,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardCompleted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  topicText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxDone: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  actionIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
