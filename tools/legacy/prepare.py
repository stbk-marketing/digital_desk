"""Read a mysqldump as data, never execute SQL. Outputs belong outside public/Git."""
import argparse
import collections
import gzip
import hashlib
import json
import re
from pathlib import Path


def statements(text):
    start, quoted, escaped = 0, False, False
    for i, char in enumerate(text):
        if escaped:
            escaped = False
        elif quoted and char == "\\":
            escaped = True
        elif char == "'":
            quoted = not quoted
        elif char == ";" and not quoted:
            yield text[start:i + 1]
            start = i + 1
    if quoted:
        raise ValueError("Unterminated SQL string")


def tuples(text):
    i = 0
    escapes = {"0": "\0", "n": "\n", "r": "\r", "t": "\t", "b": "\b", "Z": "\x1a"}
    while i < len(text):
        if text[i] in " ,;\n\r\t":
            i += 1
            continue
        if text[i] != "(":
            raise ValueError("Unsupported INSERT syntax")
        i += 1
        row = []
        while True:
            while text[i].isspace():
                i += 1
            if text[i] == "'":
                i += 1
                value = ""
                while True:
                    char = text[i]
                    i += 1
                    if char == "\\":
                        char = text[i]
                        i += 1
                        value += escapes.get(char, char)
                    elif char == "'":
                        if i < len(text) and text[i] == "'":
                            value += "'"
                            i += 1
                        else:
                            break
                    else:
                        value += char
            else:
                end = i
                while text[end] not in ",)":
                    end += 1
                token = text[i:end].strip()
                if token == "NULL":
                    value = None
                elif re.fullmatch(r"-?\d+", token):
                    value = int(token)
                elif re.fullmatch(r"-?\d+\.\d+", token):
                    value = float(token)
                else:
                    raise ValueError(f"Unsupported literal: {token[:30]}")
                i = end
            row.append(value)
            while text[i].isspace():
                i += 1
            char = text[i]
            i += 1
            if char == ")":
                break
            if char != ",":
                raise ValueError("Invalid tuple")
        yield row


def read_dump(path):
    # gzip verifies CRC and length at EOF; strict UTF-8 rejects encoding loss.
    sql = gzip.open(path, "rt", encoding="utf-8", errors="strict").read()
    if not re.search(r"-- Dump completed on \d{4}-\d\d-\d\d", sql):
        raise ValueError("Missing dump completion marker")
    schemas, tables = {}, {}
    for match in re.finditer(r"CREATE TABLE `([^`]+)` \((.*?)\) ENGINE=.*?;", sql, re.S):
        table, body = match.groups()
        fields = re.findall(r"^  `([^`]+)` (.+?)(?:,)?$", body, re.M)
        schemas[table] = {"columns": [f[0] for f in fields], "definition": body,
                          "foreign_keys": re.findall(r"FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)", body)}
        tables[table] = []
    insert_count = 0
    for statement in statements(sql):
        # Comments before INSERT are part of the preceding statement fragment.
        match = re.search(r"(?:^|\n)INSERT INTO `([^`]+)`(?: \(([^\n]+?)\))? VALUES\s*", statement)
        if not match:
            if re.search(r"(?:^|\n)INSERT INTO", statement):
                raise ValueError("Unsupported INSERT statement")
            continue
        table, explicit = match.groups()
        if table not in schemas:
            raise ValueError(f"Missing schema: {table}")
        columns = re.findall(r"`([^`]+)`", explicit) if explicit else schemas[table]["columns"]
        for values in tuples(statement[match.end():]):
            if len(columns) != len(values):
                raise ValueError(f"Column count mismatch: {table}")
            tables[table].append(dict(zip(columns, values)))
        insert_count += 1
    for table, schema in schemas.items():
        for column in re.findall(r"CHECK \(json_valid\(`([^`]+)`\)\)", schema['definition']):
            for row in tables[table]:
                if row[column] is not None:
                    json.loads(row[column])
        if "id" in schema["columns"]:
            ids = [r["id"] for r in tables[table]]
            if len(set(ids)) != len(ids):
                raise ValueError(f"Duplicate IDs: {table}")
        for declaration in re.findall(r"(?:PRIMARY KEY|UNIQUE KEY `[^`]+`) \(([^\n]+)\)", schema['definition']):
            columns = re.findall(r"`([^`]+)`", declaration)
            seen = set()
            for row in tables[table]:
                values = tuple(row[c] for c in columns)
                if None in values:  # MySQL permits repeated NULL in unique indexes.
                    continue
                if values in seen:
                    raise ValueError(f"Duplicate unique key: {table}.{columns}")
                seen.add(values)
        for column, target, key in schema["foreign_keys"]:
            valid = {r[key] for r in tables[target]}
            missing = [r.get("id") for r in tables[table] if r[column] is not None and r[column] not in valid]
            if missing:
                raise ValueError(f"Orphan foreign key {table}.{column}: {missing}")
    for row in tables.get('media', []):
        parent = {'Ticket': 'tickets', 'Project': 'projects', 'TicketComment': 'ticket_comments'}.get(row['model_type'].split('\\')[-1])
        if parent is None or row['model_id'] not in {r['id'] for r in tables[parent]}:
            raise ValueError(f"Unresolved media owner: media:{row['id']}")
    return schemas, tables, insert_count


def text_of(row):
    return "\n".join(str(v) for v in row.values() if v is not None)


def source_id(row):
    if "id" in row:
        return row["id"]
    if "ticket_id" in row:
        return f"{row['ticket_id']}:{row['user_id']}"
    return f"{row['department_id']}:{row['user_id']}"


def classify(tables):
    exact = re.compile(r"filial(?:e|en)[\s_-]*(?:des[\s_-]*)?monat(?:s)?|\bfdm\b", re.I)
    possible = re.compile(r"filial.*monat|monat.*filial", re.I | re.S)
    reasons, uncertain = {}, {}
    for table, rows in tables.items():
        for pos, row in enumerate(rows):
            key = (table, source_id(row) if "id" in row or "user_id" in row else f"row-{pos + 1}")
            txt = text_of(row)
            if exact.search(txt):
                reasons[key] = "Bezeichnung im Datensatz"
            elif possible.search(txt):
                uncertain[key] = "Filiale und Monat erwähnt; fachlich prüfen"
    # Only follow owned business children. Never pull unrelated siblings via a shared user/department.
    changed = True
    links = [("tickets", "project_id", "projects"), ("tickets", "ticket_category_id", "ticket_categories"),
             ("tickets", "ticket_series_id", "ticket_series"), ("ticket_comments", "ticket_id", "tickets"),
             ("ticket_assignees", "ticket_id", "tickets")]
    while changed:
        changed = False
        # A matching comment is owned by its ticket; include the complete ticket context.
        for row in tables.get('ticket_comments', []):
            if ('ticket_comments', row['id']) in reasons and ('tickets', row['ticket_id']) not in reasons:
                reasons['tickets', row['ticket_id']] = f"Zugehöriger Kommentar ticket_comments:{row['id']}"
                changed = True
        for table, column, parent in links:
            for pos, row in enumerate(tables.get(table, [])):
                key = (table, source_id(row))
                if (parent, row[column]) in reasons and key not in reasons:
                    reasons[key] = f"Relation {column} → {parent}:{row[column]}"
                    changed = True
        for row in tables.get("media", []):
            parent = {"Ticket": "tickets", "Project": "projects", "TicketComment": "ticket_comments"}.get(row["model_type"].split("\\")[-1])
            key = ("media", row["id"])
            if (parent, row["model_id"]) in reasons and key not in reasons:
                reasons[key] = f"Polymorphe Relation → {parent}:{row['model_id']}"
                changed = True
    return reasons, {k: v for k, v in uncertain.items() if k not in reasons}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dump", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    schemas, tables, insert_count = read_dump(args.dump)
    known = {"cache", "cache_locks", "department_user", "departments", "failed_jobs", "job_batches", "jobs", "media", "migrations", "password_reset_tokens", "projects", "sessions", "ticket_assignees", "ticket_categories", "ticket_comments", "ticket_series", "tickets", "users"}
    if set(tables) != known:
        raise ValueError(f"Changed schema requires a new analysis: extra={set(tables) - known}, missing={known - set(tables)}")
    reasons, uncertain = classify(tables)
    classified = []
    for table, rows in tables.items():
        for pos, row in enumerate(rows):
            key = (table, source_id(row) if "id" in row or "user_id" in row else f"row-{pos + 1}")
            if key in reasons or key in uncertain:
                classified.append({"table": table, "id": key[1], "certainty": "eindeutig" if key in reasons else "prüfen",
                                   "reason": reasons.get(key, uncertain.get(key)), "row": row})
    summary = {"counts": {t: len(r) for t, r in tables.items()}, "insert_statements": insert_count,
               "sha256": hashlib.sha256(args.dump.read_bytes()).hexdigest(),
               "fdm_counts": dict(collections.Counter(r["table"] for r in classified if r["certainty"] == "eindeutig")),
               "uncertain_counts": dict(collections.Counter(r["table"] for r in classified if r["certainty"] != "eindeutig")),
               "statuses": {t: dict(collections.Counter(r.get("status") for r in tables[t])) for t in ["projects", "tickets"]}}
    business = ["departments", "department_user", "media", "projects", "ticket_assignees", "ticket_categories", "ticket_comments", "ticket_series", "tickets", "users"]
    # Credentials and session/cache content must never enter the migration input.
    clean = {t: [{k: v for k, v in r.items() if t != "users" or k in ("id", "name", "email", "created_at", "updated_at")} for r in tables[t]] for t in business}
    migration = {"format": 1, "source": "aufgabenplaner", "sha256": summary["sha256"], "tables": clean,
                 "excluded": [{"table": t, "id": i, "reason": reason} for (t, i), reason in reasons.items()],
                 "uncertain": [{"table": t, "id": i, "reason": reason} for (t, i), reason in uncertain.items()]}
    for name, value in [("source.json", {"format": 1, "source": "aufgabenplaner", "sha256": summary["sha256"], "tables": tables}),
                        ("migration.json", migration), ("schema.json", schemas), ("fdm.json", classified), ("analysis.json", summary)]:
        (args.output / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
