#!/usr/bin/env python3
"""
Clean Data Loader for AOP Network Visualizer

This module provides functions to load and search the preprocessed clean data files.
It replaces the raw TSV parsing with fast, accurate lookups using normalized data.
"""

import os
import json
import logging
from typing import Dict, List, Set, Any, Optional, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)


class CleanDataLoader:
    """Loads and provides access to preprocessed clean AOP data."""
    
    def __init__(self, data_dir: str = None):
        """Initialize the loader with data directory."""
        if data_dir is None:
            data_dir = os.path.dirname(os.path.abspath(__file__))
        
        self.data_dir = data_dir
        self.entities = {}  # event_id -> entity data
        self.aop_metadata = {}  # aop_id -> metadata
        self.edges = []  # All relationships
        self.search_index = {}  # Optimized search index
        self.loaded = False
    
    def load_clean_data(self) -> bool:
        """Load the preprocessed clean data files."""
        try:
            # Load main entities file
            entities_path = os.path.join(self.data_dir, 'clean_aop_entities.json')
            if not os.path.exists(entities_path):
                logger.error(f"Clean entities file not found: {entities_path}")
                return False
            
            with open(entities_path, 'r', encoding='utf-8') as f:
                clean_data = json.load(f)
            
            self.entities = clean_data['entities']
            self.aop_metadata = clean_data['aop_metadata']
            self.edges = clean_data['edges']
            
            # Load search index
            index_path = os.path.join(self.data_dir, 'aop_search_index.json')
            if os.path.exists(index_path):
                with open(index_path, 'r', encoding='utf-8') as f:
                    self.search_index = json.load(f)
            else:
                logger.warning(f"Search index not found: {index_path}")
                self.search_index = {'entities_by_name': {}}
            
            self.loaded = True
            logger.info(f"Loaded clean data: {len(self.entities)} entities, {len(self.aop_metadata)} AOPs, {len(self.edges)} edges")
            return True
            
        except Exception as e:
            logger.error(f"Error loading clean data: {e}")
            return False
    
    def search_entities_by_name(self, search_term: str, exact_match: bool = False) -> List[Dict[str, Any]]:
        """
        Search for entities by name using the clean data.
        
        Args:
            search_term: The term to search for
            exact_match: If True, require exact match; if False, allow substring matching
        
        Returns:
            List of matching entity information with AOPs
        """
        if not self.loaded:
            return []
        
        search_term_lower = search_term.lower().strip()
        if not search_term_lower:
            return []
        
        matching_entities = []
        entities_by_name = self.search_index.get('entities_by_name', {})
        
        for entity_name, entity_info in entities_by_name.items():
            entity_name_lower = entity_name.lower()
            
            # Check for match based on search mode
            is_match = False
            if exact_match:
                is_match = search_term_lower == entity_name_lower
            else:
                is_match = search_term_lower in entity_name_lower
            
            if is_match:
                matching_entities.append({
                    'name': entity_name,
                    'entity_type': entity_info['entity_type'],
                    'event_ids': entity_info['event_ids'],
                    'aop_ids': entity_info['aop_ids'],
                    'aop_count': len(entity_info['aop_ids'])
                })
        
        # Sort by relevance (exact matches first, then by AOP count)
        matching_entities.sort(key=lambda x: (
            0 if search_term_lower == x['name'].lower() else 1,
            -x['aop_count'],
            x['name'].lower()
        ))
        
        return matching_entities
    
    def get_complete_aop_network(self, aop_ids: List[str]) -> Dict[str, Any]:
        """
        Get complete network data for specified AOPs.
        
        Args:
            aop_ids: List of AOP IDs to include
        
        Returns:
            Complete network with nodes and edges
        """
        if not self.loaded:
            return {'nodes': [], 'edges': []}
        
        aop_ids_set = set(aop_ids)
        network_nodes = []
        network_edges = []
        included_event_ids = set()
        
        # Get all nodes for the specified AOPs
        for event_id, entity in self.entities.items():
            entity_aop_ids = entity.get('aop_ids', [])
            if any(aop_id in aop_ids_set for aop_id in entity_aop_ids):
                # Convert entity to node format
                node_data = {
                    'id': event_id,
                    'label': entity['clean_name'],
                    'type': entity['event_type'],
                    'aop': entity_aop_ids[0] if entity_aop_ids else '',  # Use first AOP as primary
                    'all_aops': entity_aop_ids,  # Include all AOPs this entity appears in
                    **{k: v for k, v in entity.items() if k not in ['event_id', 'clean_name', 'event_type', 'aop_ids']}
                }
                network_nodes.append(node_data)
                included_event_ids.add(event_id)
        
        # Get all edges for the specified AOPs
        for edge in self.edges:
            edge_aop = edge.get('aop', '')
            if edge_aop in aop_ids_set:
                # Only include edges where both source and target are in our node set
                if edge.get('source') in included_event_ids and edge.get('target') in included_event_ids:
                    network_edges.append(edge)
        
        return {
            'nodes': network_nodes,
            'edges': network_edges
        }
    
    def find_aops_by_search_term(self, search_term: str) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Find all AOPs containing entities that match the search term.
        
        Args:
            search_term: The term to search for
        
        Returns:
            Tuple of (list of AOP IDs, list of matching entity details)
        """
        matching_entities = self.search_entities_by_name(search_term, exact_match=True)
        
        if not matching_entities:
            return [], []
        
        # Collect all AOP IDs from matching entities
        all_aop_ids = set()
        entity_details = []
        
        for entity_match in matching_entities:
            all_aop_ids.update(entity_match['aop_ids'])
            entity_details.append({
                'name': entity_match['name'],
                'type': entity_match['entity_type'],
                'aop_ids': entity_match['aop_ids'],
                'event_ids': entity_match['event_ids']
            })
        
        return sorted(list(all_aop_ids)), entity_details
    
    def get_aop_info(self, aop_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific AOP."""
        return self.aop_metadata.get(aop_id)
    
    def get_aop_names_mapping(self) -> Dict[str, str]:
        """Get mapping of AOP IDs to names."""
        return {aop_id: f"AOP {aop_id.replace('Aop:', '')}" 
                for aop_id in self.aop_metadata.keys()}
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the loaded data."""
        if not self.loaded:
            return {}
        
        entity_types = defaultdict(int)
        for entity in self.entities.values():
            entity_types[entity['event_type']] += 1
        
        return {
            'total_entities': len(self.entities),
            'total_aops': len(self.aop_metadata),
            'total_edges': len(self.edges),
            'entity_types': dict(entity_types),
            'unique_entity_names': len(self.search_index.get('entities_by_name', {}))
        }


# Global instance for easy access
_clean_data_loader = None


def get_clean_data_loader() -> CleanDataLoader:
    """Get the global clean data loader instance."""
    global _clean_data_loader
    if _clean_data_loader is None:
        _clean_data_loader = CleanDataLoader()
        _clean_data_loader.load_clean_data()
    return _clean_data_loader


def search_entities(search_term: str, exact_match: bool = False) -> List[Dict[str, Any]]:
    """Search for entities by name (convenience function)."""
    loader = get_clean_data_loader()
    return loader.search_entities_by_name(search_term, exact_match)


def get_aop_network(aop_ids: List[str]) -> Dict[str, Any]:
    """Get complete network for AOPs (convenience function)."""
    loader = get_clean_data_loader()
    return loader.get_complete_aop_network(aop_ids)


def find_aops_containing_term(search_term: str) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Find AOPs containing a search term (convenience function)."""
    loader = get_clean_data_loader()
    return loader.find_aops_by_search_term(search_term)