// Scope before ranking; filter tombstones after ranking to prevent resurrection.
export const LIST_STATE = `
with latest as (
  select entity_id, payload_json, updated_at, deleted,
    row_number() over (partition by entity_id order by updated_at desc, version_id desc) as position
  from identifier(?)
  where app_id = ? and owner_id = ?
)
select entity_id, payload_json, updated_at, deleted
from latest
where position = 1 and deleted = false and entity_id > ?
order by entity_id
limit 51`;

export const GET_STATE = `
select entity_id, payload_json, updated_at, deleted
from identifier(?)
where app_id = ? and owner_id = ? and entity_id = ?
order by updated_at desc, version_id desc
limit 1`;

// The timestamp/version are bound once per attempt. Driver retries cannot reorder
// an identical write. No MERGE uniqueness assumption or runtime DDL is required.
export const APPEND_STATE = `
insert into identifier(?)
  (app_id, owner_id, entity_id, version_id, updated_at, deleted, payload_json)
values (?, ?, ?, ?, ?, ?, ?)`;
