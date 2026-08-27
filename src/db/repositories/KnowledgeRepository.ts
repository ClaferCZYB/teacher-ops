import { BaseRepository } from '../BaseRepository'
import type { KnowledgePoint, BehaviorRule } from '@/types/models'
import type { StoreName } from '../index'

class KPRepo extends BaseRepository<KnowledgePoint> {
  store: StoreName = 'knowledgePoints'
}

class BehaviorRuleRepo extends BaseRepository<BehaviorRule> {
  store: StoreName = 'behaviorRules'
}

export const knowledgePointRepo = new KPRepo()
export const behaviorRuleRepo = new BehaviorRuleRepo()
