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
  name: __t.string(),
  address: __t.string(),
  createdAt: __t.timestamp().name("created_at"),
});
