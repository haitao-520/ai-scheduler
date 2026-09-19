import { Capacitor, registerPlugin } from '@capacitor/core'
import { buildShiftsPayload } from './widget'
import type { DayShifts } from '../types'

interface ShiftAlarmPlugin {
  sync(options: { data: string; enabled: boolean; leadMinutes: number }): Promise<void>
  requestPermission(): Promise<{ granted: boolean }>
  test(): Promise<void>
}

const ShiftAlarm = registerPlugin<ShiftAlarmPlugin>('ShiftAlarm')

export function syncShiftAlarms(shifts: DayShifts, enabled: boolean, leadMinutes: number): void {
  if (!Capacitor.isNativePlatform()) return
  ShiftAlarm.sync({ data: buildShiftsPayload(shifts), enabled, leadMinutes }).catch(() => {
    // 提醒同步失败不影响主流程
  })
}

export function requestShiftAlarmPermission(): void {
  if (!Capacitor.isNativePlatform()) return
  ShiftAlarm.requestPermission().catch(() => {
    // 用户拒绝通知权限时静默处理
  })
}

export function testShiftAlarm(): void {
  if (!Capacitor.isNativePlatform()) return
  ShiftAlarm.test().catch(() => {
    // 测试通知失败不影响主流程
  })
}
