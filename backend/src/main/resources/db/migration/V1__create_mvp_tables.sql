CREATE TABLE users
(
    id         INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    email      TEXT UNIQUE,
    is_agent   INTEGER NOT NULL DEFAULT FALSE CHECK (is_agent IN (TRUE, FALSE)),
    created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE projects
(
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    brief_md    TEXT,
    archived_at INTEGER,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE tasks
(
    id                 INTEGER PRIMARY KEY,
    project_id         INTEGER NOT NULL,
    title              TEXT    NOT NULL,
    description_md     TEXT,
    status             TEXT    NOT NULL DEFAULT 'backlog' CHECK (status in
                                                                 ('backlog', 'ready', 'in_progress', 'needs_approval',
                                                                  'blocked', 'done')),
    assignee_user_id   INTEGER,
    output_md          TEXT,
    attempts           INTEGER NOT NULL DEFAULT 0,
    require_sign_off   INTEGER NOT NULL DEFAULT TRUE CHECK (require_sign_off IN (TRUE, FALSE)),
    created_by_user_id INTEGER NOT NULL,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL,
    done_at            INTEGER,

    FOREIGN KEY (project_id) REFERENCES projects (id),
    FOREIGN KEY (assignee_user_id) REFERENCES users (id),
    FOREIGN KEY (created_by_user_id) REFERENCES users (id)
) STRICT;
CREATE INDEX idx_tasks_project_id_status ON tasks (project_id, status);

CREATE TABLE task_deps
(
    task_id            INTEGER NOT NULL,
    depends_on_task_id INTEGER NOT NULL,

    PRIMARY KEY (task_id, depends_on_task_id),

    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_task_id) REFERENCES tasks (id) ON DELETE CASCADE,

    CHECK (task_id <> depends_on_task_id)
) STRICT;
CREATE INDEX idx_task_deps_depends_on_task_id ON task_deps (depends_on_task_id);

CREATE TABLE runs
(
    id                INTEGER PRIMARY KEY,
    task_id           INTEGER NOT NULL,
    executor          TEXT    NOT NULL,
    model             TEXT    NOT NULL,
    state             TEXT    NOT NULL DEFAULT 'running' CHECK (state in
                                                                ('running', 'succeeded', 'needs_human', 'failed',
                                                                 'timed_out', 'cancelled')),
    lease_token       TEXT    NOT NULL,
    lease_expires_at  INTEGER NOT NULL,
    last_heartbeat_at INTEGER,
    summary           TEXT,
    error             TEXT,
    cost_microusd     INTEGER,
    log_ref           TEXT,
    started_at        INTEGER NOT NULL,
    ended_at          INTEGER,

    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
) STRICT;
CREATE INDEX idx_runs_task_id ON runs (task_id);
CREATE UNIQUE INDEX one_running_run ON runs ((1)) WHERE state = 'running'; -- only one running run allowed

CREATE TABLE approvers
(
    user_id INTEGER PRIMARY KEY,

    FOREIGN KEY (user_id) REFERENCES users (id)
) STRICT;

CREATE TABLE approvals
(
    id                 INTEGER PRIMARY KEY,
    task_id            INTEGER NOT NULL,
    run_id             INTEGER NOT NULL,
    kind               TEXT    NOT NULL CHECK (kind in ('sign_off', 'proceed')),
    requestor_user_id  INTEGER NOT NULL,
    summary            TEXT    NOT NULL,
    payload_md         TEXT    NOT NULL,
    state              TEXT    NOT NULL DEFAULT 'pending' CHECK (state in
                                                                 ('pending', 'approved', 'changes_requested',
                                                                  'rejected',
                                                                  'cancelled')),
    decided_by_user_id INTEGER,
    decision_comment   TEXT,
    created_at         INTEGER NOT NULL,
    decided_at         INTEGER,

    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (run_id) REFERENCES runs (id) ON DELETE CASCADE,
    FOREIGN KEY (requestor_user_id) REFERENCES users (id),
    FOREIGN KEY (decided_by_user_id) REFERENCES approvers (user_id)
) STRICT;
CREATE INDEX idx_approvals_task_id ON approvals (task_id);
CREATE UNIQUE INDEX one_pending_approval_per_task ON approvals (task_id) WHERE state = 'pending'; -- only one pending approval allowed per task

CREATE TABLE project_notes
(
    id             INTEGER PRIMARY KEY,
    project_id     INTEGER NOT NULL,
    author_user_id INTEGER NOT NULL,
    body_md        TEXT    NOT NULL,
    pinned         INTEGER NOT NULL DEFAULT FALSE CHECK (pinned IN (TRUE, FALSE)),
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,

    FOREIGN KEY (project_id) REFERENCES projects (id),
    FOREIGN KEY (author_user_id) REFERENCES users (id)
) STRICT;
CREATE INDEX idx_project_notes_project_id ON project_notes (project_id);

CREATE TABLE comments
(
    id             INTEGER PRIMARY KEY,
    task_id        INTEGER NOT NULL,
    author_user_id INTEGER NOT NULL,
    body_md        TEXT    NOT NULL,
    kind           TEXT    NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'question', 'answer')),
    reply_to_id    INTEGER,
    resolved_at    INTEGER,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,

    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (author_user_id) REFERENCES users (id),
    FOREIGN KEY (reply_to_id) REFERENCES comments (id) ON DELETE CASCADE
) STRICT;
CREATE INDEX idx_comments_task_id ON comments (task_id);

CREATE TABLE events
(
    id         INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    task_id    INTEGER,
    user_id    INTEGER NOT NULL,
    type       TEXT    NOT NULL,
    data_json  TEXT    NOT NULL,
    created_at INTEGER NOT NULL,

    FOREIGN KEY (project_id) REFERENCES projects (id),
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
) STRICT;
CREATE INDEX idx_events_project_id ON events (project_id);
CREATE INDEX idx_events_task_id ON events (task_id);