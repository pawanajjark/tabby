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
  subjectIdentity: __t.identity().name("subject_identity"),
  subjectName: __t.string().name("subject_name"),
  category: __t.string(),
  memoryKey: __t.string().name("memory_key"),
  value: __t.string(),
  sourceMessageId: __t.u64().name("source_message_id"),
  updatedAt: __t.timestamp().name("updated_at"),
});
