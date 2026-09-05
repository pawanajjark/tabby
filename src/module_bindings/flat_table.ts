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
  residenceId: __t.u64().name("residence_id"),
  name: __t.string(),
  flatNumber: __t.string().name("flat_number"),
  createdAt: __t.timestamp().name("created_at"),
});
