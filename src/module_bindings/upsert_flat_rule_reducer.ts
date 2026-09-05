/* eslint-disable */
/* tslint:disable */
import { t as __t } from "spacetimedb";

export default {
  id: __t.u64(),
  ruleType: __t.string().name("rule_type"),
  title: __t.string(),
  description: __t.string(),
};
