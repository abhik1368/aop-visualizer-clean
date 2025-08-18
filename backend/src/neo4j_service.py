import os
import logging
from typing import Any, Dict, List, Optional, Tuple

from neo4j import GraphDatabase

logger = logging.getLogger(__name__)

_driver = None  # type: ignore[var-annotated]
_database: Optional[str] = None

# Map UI filter terms to Neo4j labels
BY_TO_LABEL = {
    "chemical": "CHEMICAL",
    "disease": "DISEASE",
    "aop": "AOP",
    "gene": "GENE",
    "key_event": "KEY_EVENT",
    "ke": "KEY_EVENT",
    "mie": "MIE",
    "ao": "AO",
    "all": None,
}


def _get_env_credentials() -> Tuple[str, Optional[str], str, Optional[str]]:
    """Read Neo4j connection info from environment.

    Returns: (uri, user, password, database)
    """
    uri = os.getenv("NEO4J_URI", "")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "")
    database = os.getenv("NEO4J_DATABASE", os.getenv("NEO4J_NAME", None))
    return uri, user, password, database


def get_connection():
    """Return a singleton Neo4j Driver (official driver). Raises if not configured.

    Supports neo4j+s, neo4j+ssc, neo4j, bolt, bolt+s URIs.
    """
    global _driver, _database
    if _driver is not None:
        return _driver

    uri, user, password, database = _get_env_credentials()
    if not uri or not password:
        raise RuntimeError(
            "Neo4j connection not configured. Set NEO4J_URI and NEO4J_PASSWORD in environment/.env."
        )

    _database = database
    logger.info("Connecting to Neo4j (official driver) at %s (db=%s)", uri, database or "default")
    _driver = GraphDatabase.driver(uri, auth=(user, password))
    # sanity check
    _driver.verify_connectivity()
    return _driver


def _get_session():
    drv = get_connection()
    if _database:
        return drv.session(database=_database)
    return drv.session()


def _label_from_labels(labels: List[str]) -> str:
    return labels[0] if labels else "NODE"


def _node_id_from(id_int: int, labels: List[str]) -> str:
    return f"{_label_from_labels(labels)}:{id_int}"


def _edge_id_from(rel_type: str, rid: int) -> str:
    return f"{rel_type}:{rid}"


def _node_label_from_props(props: Dict[str, Any], labels: List[str], identity: int) -> str:
    # Prefer common name fields
    for key in ("name", "label", "title", "id"):
        if key in props and props[key] not in (None, ""):
            return str(props[key])
    return f"{_label_from_labels(labels)} {identity}"


def _serialize_node_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows:
        nid = int(row["id"])
        labels = list(row.get("labels", []))
        props = dict(row.get("props", {}))
        out.append({
            "id": _node_id_from(nid, labels),
            "label": _node_label_from_props(props, labels, nid),
            "type": _label_from_labels(labels),
            **props,
        })
    return out


def _build_edge_objects(edge_rows: List[Dict[str, Any]], node_map: Dict[int, Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in edge_rows:
        rid = int(row["id"])
        rtype = str(row["type"])
        sid = int(row["sid"])
        tid = int(row["tid"])
        props = dict(row.get("props", {}))
        source_str = node_map.get(sid, {}).get("id", f"NODE:{sid}")
        target_str = node_map.get(tid, {}).get("id", f"NODE:{tid}")
        out.append({
            "id": _edge_id_from(rtype, rid),
            "label": rtype,
            "type": rtype,
            "source": source_str,
            "target": target_str,
            **props,
        })
    return out


def search_nodes(q: str, by: str = "all", limit: int = 50) -> List[Dict[str, Any]]:
    """Search nodes by label filter and text query across common name fields.

    Returns list of { id, label, type, ...properties }
    """
    label = BY_TO_LABEL.get(by.lower(), None)
    params = {"limit": int(limit)}
    with _get_session() as session:
        if not q or not q.strip():
            cypher = "MATCH (n) RETURN id(n) AS id, labels(n) AS labels, properties(n) AS props LIMIT $limit"
            rows = [dict(r) for r in session.run(cypher, **params)]
            return _serialize_node_rows(rows)

        params.update({"q": q.lower()})
        if label:
            cypher = (
                f"MATCH (n:`{label}`) "
                "WHERE toLower(coalesce(n.name,'')) CONTAINS $q "
                "   OR toLower(coalesce(n.label,'')) CONTAINS $q "
                "   OR toLower(coalesce(n.title,'')) CONTAINS $q "
                "RETURN id(n) AS id, labels(n) AS labels, properties(n) AS props LIMIT $limit"
            )
        else:
            cypher = (
                "MATCH (n) "
                "WHERE toLower(coalesce(n.name,'')) CONTAINS $q "
                "   OR toLower(coalesce(n.label,'')) CONTAINS $q "
                "   OR toLower(coalesce(n.title,'')) CONTAINS $q "
                "RETURN id(n) AS id, labels(n) AS labels, properties(n) AS props LIMIT $limit"
            )
        rows = [dict(r) for r in session.run(cypher, **params)]
        return _serialize_node_rows(rows)


def fetch_subgraph(term: str, by: str = "all", depth: int = 2, limit_paths: int = 1000) -> Dict[str, Any]:
    """Fetch a neighborhood subgraph around nodes matching a term.

    Returns { nodes: [...], edges: [...] }
    """
    label = BY_TO_LABEL.get(by.lower(), None)
    term_lc = term.lower()

    with _get_session() as session:
        # Step 1: find seed node ids (prefer exact match, then contains)
        if label:
            cy_exact = (
                f"MATCH (n:`{label}`) "
                "WHERE toLower(coalesce(n.name,n.label,n.title,'')) = $term "
                "RETURN id(n) AS id LIMIT 50"
            )
            seed_exact = [dict(r) for r in session.run(cy_exact, term=term_lc)]
            if not seed_exact:
                cy_cont = (
                    f"MATCH (n:`{label}`) "
                    "WHERE toLower(coalesce(n.name,n.label,n.title,'')) CONTAINS $term "
                    "RETURN id(n) AS id LIMIT 25"
                )
                seed_exact = [dict(r) for r in session.run(cy_cont, term=term_lc)]
        else:
            cy_exact = (
                "MATCH (n) "
                "WHERE toLower(coalesce(n.name,n.label,n.title,'')) = $term "
                "RETURN id(n) AS id LIMIT 50"
            )
            seed_exact = [dict(r) for r in session.run(cy_exact, term=term_lc)]
            if not seed_exact:
                cy_cont = (
                    "MATCH (n) "
                    "WHERE toLower(coalesce(n.name,n.label,n.title,'')) CONTAINS $term "
                    "RETURN id(n) AS id LIMIT 25"
                )
                seed_exact = [dict(r) for r in session.run(cy_cont, term=term_lc)]

        start_ids = [int(row["id"]) for row in seed_exact]
        if not start_ids:
            return {"nodes": [], "edges": []}

        # Step 2: collect nodes and relationships up to given depth
        depth_int = int(depth)
        params = {"ids": start_ids, "limit": int(limit_paths)}
        cy_nodes = (
            f"MATCH p=(n)-[r*1..{depth_int}]-(m) "
            "WHERE id(n) IN $ids "
            "UNWIND nodes(p) AS x "
            "RETURN DISTINCT id(x) AS id, labels(x) AS labels, properties(x) AS props "
            "LIMIT $limit"
        )
        node_rows = [dict(r) for r in session.run(cy_nodes, **params)]
        nodes = _serialize_node_rows(node_rows)
        node_map_by_int_id = {int(r["id"]): n for r, n in zip(node_rows, nodes)}

        cy_edges = (
            f"MATCH p=(n)-[r*1..{depth_int}]-(m) "
            "WHERE id(n) IN $ids "
            "UNWIND relationships(p) AS e "
            "RETURN DISTINCT id(e) AS id, type(e) AS type, id(startNode(e)) AS sid, id(endNode(e)) AS tid, properties(e) AS props "
            "LIMIT $limit"
        )
        edge_rows = [dict(r) for r in session.run(cy_edges, **params)]
        edges = _build_edge_objects(edge_rows, node_map_by_int_id)

        # Step 3a: Filter out unwanted node categories entirely so they don't appear even in hypernodes
        # - Tissue / Organ nodes
        # - KEY_EVENT_RELATIONSHIP group nodes
        # - WOE (Weight of Evidence) group nodes
        def _is_removed(n: Dict[str, Any]) -> bool:
            ntype = str(n.get("type", "")).upper()
            label_text = f"{n.get('label','')} {n.get('name','')} {n.get('title','')}".lower()
            # Remove tissue/organ by type or by text (defensive)
            if ntype in {"TISSUE", "ORGAN"}:
                return True
            if "tissue" in label_text or "organ" in label_text:
                return True
            # Remove specific group nodes
            if "group" in label_text:
                if "key_event_relationship" in label_text:
                    return True
                if "woe" in label_text or "weight of evidence" in label_text:
                    return True
            return False

        filtered_nodes = [n for n in nodes if not _is_removed(n)]
        kept_ids = {n["id"] for n in filtered_nodes}
        filtered_edges = [e for e in edges if e.get("source") in kept_ids and e.get("target") in kept_ids]

        # Step 3: Reclassify MIE nodes based on relationships
        # If a node participates in a HAS_MOLECULAR_INITIATING_EVENT relation, mark it as MolecularInitiatingEvent
        if filtered_edges and filtered_nodes:
            node_by_id_str = {n["id"]: n for n in filtered_nodes}
            for e in filtered_edges:
                etype = str(e.get("type", ""))
                if "molecular_initiating_event" in etype.lower():
                    # Prefer the target as the MIE. If data orientation differs, also check source.
                    for endpoint in (e.get("target"), e.get("source")):
                        n = node_by_id_str.get(endpoint)
                        if not n:
                            continue
                        ntype = n.get("type")
                        if ntype in ("KeyEvent", "KEY_EVENT", "KE"):
                            # Preserve original type, then retype to MolecularInitiatingEvent
                            if "original_type" not in n:
                                n["original_type"] = ntype
                            n["type"] = "MolecularInitiatingEvent"
                            n["is_mie"] = True

        return {
            "nodes": filtered_nodes,
            "edges": filtered_edges,
            "seed_ids": [str(i) for i in start_ids],
            "depth": depth,
        }
