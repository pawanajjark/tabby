/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  id: __t.u64().primaryKey(),
  flatId: __t.u64().name("flat_id"),
  ruleType: __t.string().name("rule_type"),
  title: __t.string(),
  description: __t.string(),
  createdBy: __t.identity().name("created_by"),
  createdAt: __t.timestamp().name("created_at"),
});
