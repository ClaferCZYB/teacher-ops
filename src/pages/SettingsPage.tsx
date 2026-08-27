/**
 * 设置 — 教师信息 / 主题 / 备份 / 恢复 / 数据迁移 / 危险操作
 */
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { teacherRepo, BackupService, studentRepo } from '@/db/repositories'
import { DB_VERSION } from '@/db'
import type { Teacher } from '@/types/models'
import { toast } from '@/store/toast'
import { downloadBlob, formatDate, cn } from '@/utils/helpers'
import { THEMES, getTheme, applyTheme, type ThemeId } from '@/utils/theme'
import { BEHAVIOR_KEY_LABELS, DEFAULT_BEHAVIOR_SCORES } from '@/utils/scoring'
import { behaviorRuleRepo } from '@/db/repositories'
import { Database, Upload, Trash2, Save, DownloadCloud, AlertTriangle, FileJson, Palette, RefreshCw, SlidersHorizontal } from 'lucide-react'

export function SettingsPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [restorePreview, setRestorePreview] = useState<any | null>(null)
  const [themeId, setThemeId] = useState<ThemeId>(getTheme())
  const [migrating, setMigrating] = useState(false)

  useEffect(() => {
    void (async () => {
      const t = await teacherRepo.ensureDefault()
      setTeacher(t)
      setName(t.name); setSubject(t.subject); setPhone(t.phone ?? ''); setEmail(t.email ?? ''); setNote(t.note ?? '')
    })()
  }, [])

  async function saveTeacher() {
    if (!teacher) return
    await teacherRepo.update(teacher.id, {
      name: name.trim() || teacher.name,
      subject: subject.trim() || teacher.subject,
      phone: phone.trim(),
      email: email.trim(),
      note,
    })
    toast.success('教师信息已保存')
  }

  function changeTheme(id: ThemeId) {
    setThemeId(id)
    applyTheme(id)
    toast.success(`已切换到「${THEMES.find((t) => t.id === id)?.label}」`)
  }

  async function doBackup() {
    try {
      const snap = await BackupService.export()
      const filename = `teacher-ops-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
      downloadBlob(filename, JSON.stringify(snap, null, 2))
      toast.success('已导出备份', filename)
    } catch (e) {
      toast.error('备份失败', String((e as Error)?.message ?? e))
    }
  }

  function pickRestore() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const obj = JSON.parse(text)
        setRestorePreview(obj)
      } catch (err) {
        toast.error('文件解析失败', String((err as Error)?.message ?? err))
      }
    }
    input.click()
  }

  async function applyRestore() {
    if (!restorePreview) return
    try {
      await BackupService.import(restorePreview, 'replace')
      toast.success('已恢复，请刷新页面查看')
      setRestorePreview(null)
    } catch (e) {
      toast.error('恢复失败', String((e as Error)?.message ?? e))
    }
  }

  async function doWipe() {
    await BackupService.wipeAll()
    toast.success('已清空所有业务数据')
  }

  async function doMigrate() {
    setMigrating(true)
    try {
      const n = await studentRepo.migrateAllPersist()
      if (n > 0) toast.success(`已迁移 ${n} 条学生记录到新格式`)
      else toast.info('当前数据已是最新格式')
    } catch (e) {
      toast.error('迁移失败', String((e as Error)?.message ?? e))
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="设置" description="教师信息、主题、数据备份与恢复" />

      {/* 主题 */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Palette size={14} /> 主题配色</h2>
        <p className="text-xs text-soft mb-3">按个人偏好切换。整体配色统一，仅主色和底色变化。</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => changeTheme(t.id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md border transition-all text-left',
                themeId === t.id ? 'border-ink-700 bg-paper-50 shadow-soft' : 'border-ink-200 hover:bg-ink-50',
              )}
            >
              <span
                aria-hidden
                className="w-9 h-9 shrink-0 rounded-full ring-1 ring-ink-200"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${t.swatch} 0%, ${t.swatch} 60%, ${t.swatch} 100%)`,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  {t.label}
                  {themeId === t.id && <span className="text-2xs px-1.5 py-0.5 rounded bg-ink-700 text-paper-50">使用中</span>}
                </div>
                <div className="text-xs text-soft mt-0.5 truncate">{t.blurb}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 教师信息 */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">教师信息</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="姓名"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="任教学科"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="手机"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="邮箱"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="备注" className="sm:col-span-2"><textarea rows={3} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={saveTeacher}><Save size={14} /> 保存</Button>
        </div>
      </section>

      {/* 行为评分规则 */}
      <ScoreRulesCard />

      {/* 备份 */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Database size={14} /> 数据备份</h2>
        <p className="text-xs text-soft mb-3">
          将所有 IndexedDB 中的业务数据导出为 JSON，便于迁移、备份或在不同设备间同步。
        </p>
        <Button onClick={doBackup}><DownloadCloud size={14} /> 立即完整备份</Button>
      </section>

      {/* 恢复 */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Upload size={14} /> 数据恢复</h2>
        <p className="text-xs text-soft mb-3">
          选择 JSON 备份文件后，将进入预览确认。恢复会 <strong>替换</strong> 当前所有数据，请提前做好备份。
        </p>
        <Button variant="outline" onClick={pickRestore}><FileJson size={14} /> 选择备份文件</Button>

        {restorePreview && (
          <div className="mt-3 p-3 rounded-md border border-amber-200 bg-amber-50">
            <div className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} /> 即将以"替换"方式导入
            </div>
            <ul className="text-xs text-amber-800 grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(restorePreview).filter(([k]) => Array.isArray((restorePreview as any)[k])).map(([k, v]) => (
                <li key={k}>{k}：{Array.isArray(v) ? v.length : 0} 条</li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRestorePreview(null)}>取消</Button>
              <Button onClick={applyRestore} className="bg-amber-600 hover:bg-amber-700">确认替换</Button>
            </div>
          </div>
        )}
      </section>

      {/* 数据迁移（一次性） */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><RefreshCw size={14} /> 数据迁移</h2>
        <p className="text-xs text-soft mb-3">
          把 v1 老格式学生（单家长字段）迁移到 v2 多家长数组格式。已经做过一次后再次运行是安全的。
        </p>
        <Button variant="outline" onClick={doMigrate} loading={migrating}>运行数据迁移</Button>
      </section>

      {/* 危险操作 */}
      <section className="card p-4 border-red-100">
        <h2 className="text-sm font-semibold mb-2 text-red-700 flex items-center gap-1.5"><AlertTriangle size={14} /> 危险操作</h2>
        <p className="text-xs text-soft mb-3">清空所有业务数据（除教师设置外）。此操作不可恢复。</p>
        <Button variant="danger" onClick={() => setConfirmWipe(true)}><Trash2 size={14} /> 清空全部数据</Button>
      </section>

      {/* 关于 */}
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-2">关于</h2>
        <p className="text-xs text-soft">
          TeacherOps · 教师个人工作操作系统。本地优先：所有数据默认保存在你这台设备的浏览器中。
        </p>
        <ul className="text-xs text-soft list-disc list-inside mt-2 space-y-0.5">
          <li>创建时间：{teacher ? formatDate(teacher.createdAt) : '—'}</li>
          <li>数据版本：v{DB_VERSION}（用于后续迁移）</li>
        </ul>
      </section>

      <ConfirmDialog
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        destructive
        title="清空全部数据"
        description="所有班级、学生、记录、成绩、作业、家校沟通、待办等将被永久删除（教师设置保留）。此操作不可撤销。"
        confirmText="永久清空"
        onConfirm={doWipe}
      />
    </div>
  )
}

function Field({ label, children,  className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-soft mb-1">{label}</div>
      {children}
    </div>
  )
}

/**
 * 行为评分规则：定义「考勤 / 作业」异常对应的加减分。
 * 规则为全局（classId=''），在考勤、作业等面板记录异常时自动套用，并同步到学生积分与成长记录。
 */
function ScoreRulesCard() {
  const [rules, setRules] = useState<Record<string, { score: number; isActive: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const init: Record<string, { score: number; isActive: boolean }> = {}
      for (const k of Object.keys(BEHAVIOR_KEY_LABELS)) {
        init[k] = { score: DEFAULT_BEHAVIOR_SCORES[k] ?? 0, isActive: true }
      }
      try {
        const all = await behaviorRuleRepo.listAll()
        for (const r of all) {
          if (!r.deletedAt && r.classId === '' && r.key && r.key in init) {
            init[r.key] = { score: r.score, isActive: r.isActive }
          }
        }
      } catch { /* 忽略 */ }
      setRules(init)
      setLoading(false)
    })()
  }, [])

  async function save() {
    setSaving(true)
    try {
      const all = await behaviorRuleRepo.listAll()
      for (const key of Object.keys(BEHAVIOR_KEY_LABELS)) {
        const v = rules[key]
        if (!v) continue
        const existing = all.find((r) => !r.deletedAt && r.classId === '' && r.key === key)
        const payload = {
          classId: '',
          key,
          name: BEHAVIOR_KEY_LABELS[key],
          score: v.score,
          category: (v.score >= 0 ? 'award' : 'demerit') as 'award' | 'demerit',
          description: '',
          isActive: v.isActive,
        }
        if (existing) await behaviorRuleRepo.update(existing.id, payload)
        else await behaviorRuleRepo.create(payload as any)
      }
      toast.success('评分规则已保存')
    } catch (e) {
      toast.error('保存失败', String((e as Error)?.message ?? e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5"><SlidersHorizontal size={14} /> 行为评分规则</h2>
      <p className="text-xs text-soft mb-3">
        设置考勤 / 作业异常对应的加减分。在「考勤」「作业」面板记录相应行为时，会自动按规则计入学生成长记录与积分；正向（加分）行为由教师手动录入。
      </p>
      {loading ? (
        <div className="text-xs text-soft">加载中…</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(BEHAVIOR_KEY_LABELS).map(([key, label]) => {
            const v = rules[key] ?? { score: 0, isActive: true }
            return (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={v.isActive}
                  onChange={(e) => setRules((m) => ({ ...m, [key]: { ...v, isActive: e.target.checked } }))}
                  className="accent-ink-700"
                  aria-label={`启用 ${label}`}
                />
                <span className="flex-1 text-sm">{label}</span>
                <input
                  type="number"
                  step="0.5"
                  value={v.score}
                  onChange={(e) => setRules((m) => ({ ...m, [key]: { ...v, score: Number(e.target.value) || 0 } }))}
                  className="input w-24 py-1 text-right"
                  disabled={!v.isActive}
                />
                <span className="text-xs text-soft w-6">{v.score >= 0 ? '加分' : '扣分'}</span>
              </div>
            )
          })}
          <div className="flex justify-end pt-1">
            <Button onClick={save} loading={saving}><Save size={14} /> 保存规则</Button>
          </div>
        </div>
      )}
    </section>
  )
}