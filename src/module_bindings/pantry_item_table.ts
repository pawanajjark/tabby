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
  name: __t.string(),
  quantity: __t.i32(),
  unit: __t.string(),
  updatedBy: __t.identity().name("updated_by"),
});
