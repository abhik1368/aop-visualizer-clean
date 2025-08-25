#!/usr/bin/env python3
"""
AOP Data Preprocessor

This script processes the raw TSV files to create a clean, normalized lookup file
for accurate search and entity mapping. It removes trailing spaces, ensures uniqueness,
and creates optimized data structures for fast searching.

Usage:
    python data_preprocessor.py

Output:
    - clean_aop_entities.json: Normalized entity lookup file
    - aop_search_index.json: Optimized search index
"""

import os
import csv
import json
import re
from collections import defaultdict
from typing import Dict, List, Set, Any


class AOPDataPreprocessor:
    def __init__(self, data_dir: str = None):
        """Initialize the preprocessor with data directory."""
        if data_dir is None:
            # Default to the directory containing this script
            script_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = script_dir
        
        self.data_dir = data_dir
        self.entities = {}  # event_id -> entity data
        self.aop_metadata = {}  # aop_id -> metadata
        self.entity_to_events = defaultdict(list)  # clean_name -> [event_ids]
        self.aop_to_events = defaultdict(list)  # aop_id -> [event_ids]
        self.edges = []  # All edges/relationships
        
    def clean_text(self, text: str) -> str:
        """Clean and normalize text by removing extra spaces and standardizing format."""
        if not text or not isinstance(text, str):
            return ""
        
        # Remove leading/trailing whitespace
        cleaned = text.strip()
        
        # Replace multiple spaces with single space
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        # Normalize common patterns
        cleaned = cleaned.replace(' ,', ',')  # Fix space before comma
        cleaned = cleaned.replace('  ', ' ')  # Double spaces
        
        return cleaned
    
    def normalize_entity_name(self, name: str) -> str:
        """Normalize entity names for consistent searching."""
        if not name:
            return ""
        
        # Clean the text first
        normalized = self.clean_text(name)
        
        # Additional normalizations for search consistency
        # Keep original case but ensure consistent spacing
        return normalized
    
    def read_tsv_file(self, filename: str) -> List[List[str]]:
        """Read a TSV file and return rows as list of lists."""
        filepath = os.path.join(self.data_dir, filename)
        
        if not os.path.exists(filepath):
            print(f"Warning: File {filepath} not found")
            return []
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f, delimiter='\t')
                rows = list(reader)
                print(f"Loaded {len(rows)} rows from {filename}")
                return rows
        except Exception as e:
            print(f"Error reading {filepath}: {e}")
            return []
    
    def process_mie_ao_data(self) -> None:
        """Process the aop_ke_mie_ao.tsv file to extract entities."""
        print("Processing MIE/AO data...")
        
        rows = self.read_tsv_file("aop_ke_mie_ao.tsv")
        if not rows:
            return
        
        processed_count = 0
        for row in rows:
            if len(row) >= 4:
                aop_id = self.clean_text(row[0])
                event_id = self.clean_text(row[1])
                event_type = self.clean_text(row[2])
                event_label = self.normalize_entity_name(row[3])
                
                if aop_id and event_id and event_label:
                    # Store entity data - handle same event in multiple AOPs
                    if event_id in self.entities:
                        # Event already exists, add this AOP to the list if not already present
                        if aop_id not in self.entities[event_id]['aop_ids']:
                            self.entities[event_id]['aop_ids'].append(aop_id)
                    else:
                        # New event
                        self.entities[event_id] = {
                            'event_id': event_id,
                            'clean_name': event_label,
                            'event_type': event_type,
                            'aop_ids': [aop_id]
                        }
                    
                    # Build lookup indices
                    self.entity_to_events[event_label].append(event_id)
                    self.aop_to_events[aop_id].append(event_id)
                    
                    # Initialize AOP metadata
                    if aop_id not in self.aop_metadata:
                        self.aop_metadata[aop_id] = {
                            'aop_id': aop_id,
                            'events': [],
                            'event_count': 0
                        }
                    
                    self.aop_metadata[aop_id]['events'].append(event_id)
                    processed_count += 1
        
        print(f"Processed {processed_count} entities from MIE/AO data")
    
    def process_ec_data(self) -> None:
        """Process the aop_ke_ec.tsv file to add ontology information."""
        print("Processing EC (ontology) data...")
        
        rows = self.read_tsv_file("aop_ke_ec.tsv")
        if not rows:
            return
        
        enriched_count = 0
        for row in rows:
            if len(row) >= 6:
                event_id = self.clean_text(row[1])
                
                if event_id in self.entities:
                    # Add ontology information to existing entity
                    self.entities[event_id].update({
                        'change': self.clean_text(row[2]) if len(row) > 2 else "",
                        'ontology': self.clean_text(row[3]) if len(row) > 3 else "",
                        'ontology_id': self.clean_text(row[4]) if len(row) > 4 else "",
                        'ontology_term': self.clean_text(row[5]) if len(row) > 5 else "",
                        'secondary_ontology': self.clean_text(row[6]) if len(row) > 6 else "",
                        'secondary_id': self.clean_text(row[7]) if len(row) > 7 else "",
                        'secondary_term': self.clean_text(row[8]) if len(row) > 8 else ""
                    })
                    enriched_count += 1
        
        print(f"Enriched {enriched_count} entities with ontology data")
    
    def process_ker_data(self) -> None:
        """Process the aop_ke_ker.tsv file to extract relationships."""
        print("Processing KER (relationships) data...")
        
        rows = self.read_tsv_file("aop_ke_ker.tsv")
        if not rows:
            return
        
        processed_edges = 0
        for row in rows:
            if len(row) >= 6:
                aop_id = self.clean_text(row[0])
                source_id = self.clean_text(row[1])
                target_id = self.clean_text(row[2])
                relationship_id = self.clean_text(row[3])
                adjacency = self.clean_text(row[4])
                confidence = self.clean_text(row[5])
                
                if aop_id and source_id and target_id:
                    edge_data = {
                        'aop': aop_id,
                        'source': source_id,
                        'target': target_id,
                        'relationship': relationship_id,
                        'adjacency': adjacency,
                        'confidence': confidence,
                        'type': 'KER'
                    }
                    self.edges.append(edge_data)
                    processed_edges += 1
        
        print(f"Processed {processed_edges} relationships")
    
    def merge_duplicate_entities(self) -> None:
        """Merge entities that have the same name but appear in multiple AOPs."""
        print("Merging duplicate entities across AOPs...")
        
        # Group entities by clean name
        name_to_events = defaultdict(list)
        for event_id, entity in self.entities.items():
            clean_name = entity['clean_name']
            name_to_events[clean_name].append(event_id)
        
        merged_count = 0
        for clean_name, event_ids in name_to_events.items():
            if len(event_ids) > 1:
                # Merge all AOPs for entities with the same name
                all_aop_ids = set()
                primary_entity = None
                
                for event_id in event_ids:
                    entity = self.entities[event_id]
                    all_aop_ids.update(entity['aop_ids'])
                    
                    # Use the first entity as primary
                    if primary_entity is None:
                        primary_entity = entity
                
                # Update primary entity with all AOP IDs
                if primary_entity:
                    primary_entity['aop_ids'] = sorted(list(all_aop_ids))
                    merged_count += 1
        
        print(f"Merged {merged_count} duplicate entity names across AOPs")
    
    def build_search_index(self) -> Dict[str, Any]:
        """Build an optimized search index for fast lookups."""
        print("Building search index...")
        
        search_index = {
            'entities_by_name': {},
            'entities_by_type': defaultdict(list),
            'aops_by_entity': {},
            'entity_stats': {
                'total_entities': len(self.entities),
                'total_aops': len(self.aop_metadata),
                'total_edges': len(self.edges)
            }
        }
        
        # Index entities by name for fast search
        for event_id, entity in self.entities.items():
            clean_name = entity['clean_name']
            entity_type = entity['event_type']
            
            # Group by name (for entities appearing in multiple AOPs)
            if clean_name not in search_index['entities_by_name']:
                search_index['entities_by_name'][clean_name] = {
                    'clean_name': clean_name,
                    'entity_type': entity_type,
                    'event_ids': [],
                    'aop_ids': set()
                }
            
            search_index['entities_by_name'][clean_name]['event_ids'].append(event_id)
            search_index['entities_by_name'][clean_name]['aop_ids'].update(entity['aop_ids'])
            
            # Index by type
            search_index['entities_by_type'][entity_type].append(clean_name)
        
        # Convert sets to lists for JSON serialization
        for name_data in search_index['entities_by_name'].values():
            name_data['aop_ids'] = sorted(list(name_data['aop_ids']))
        
        # Convert defaultdict to regular dict
        search_index['entities_by_type'] = dict(search_index['entities_by_type'])
        
        return search_index
    
    def generate_clean_data_files(self) -> None:
        """Generate the clean data files."""
        print("Generating clean data files...")
        
        # Update AOP metadata with final counts
        for aop_id, metadata in self.aop_metadata.items():
            metadata['event_count'] = len(set(metadata['events']))
        
        # Generate main entities file
        clean_data = {
            'entities': self.entities,
            'aop_metadata': self.aop_metadata,
            'edges': self.edges,
            'generation_info': {
                'total_entities': len(self.entities),
                'total_aops': len(self.aop_metadata),
                'total_edges': len(self.edges),
                'unique_entity_names': len(set(entity['clean_name'] for entity in self.entities.values())),
                'generated_at': 'auto-generated'
            }
        }
        
        # Write main clean data file
        clean_data_path = os.path.join(self.data_dir, 'clean_aop_entities.json')
        with open(clean_data_path, 'w', encoding='utf-8') as f:
            json.dump(clean_data, f, indent=2, ensure_ascii=False)
        
        print(f"Generated clean entities file: {clean_data_path}")
        
        # Generate search index
        search_index = self.build_search_index()
        search_index_path = os.path.join(self.data_dir, 'aop_search_index.json')
        
        with open(search_index_path, 'w', encoding='utf-8') as f:
            json.dump(search_index, f, indent=2, ensure_ascii=False)
        
        print(f"Generated search index: {search_index_path}")
        
        # Print summary
        print("\n=== Data Processing Summary ===")
        print(f"Total entities processed: {len(self.entities)}")
        print(f"Total AOPs: {len(self.aop_metadata)}")
        print(f"Total relationships: {len(self.edges)}")
        print(f"Unique entity names: {len(set(entity['clean_name'] for entity in self.entities.values()))}")
        
        # Show some examples of entities with multiple AOPs
        multi_aop_entities = []
        for entity in self.entities.values():
            if len(entity['aop_ids']) > 1:
                multi_aop_entities.append(entity)
        
        if multi_aop_entities:
            print(f"\nEntities appearing in multiple AOPs: {len(multi_aop_entities)}")
            for i, entity in enumerate(multi_aop_entities[:5]):  # Show first 5
                print(f"  {i+1}. '{entity['clean_name']}' in AOPs: {entity['aop_ids']}")
            if len(multi_aop_entities) > 5:
                print(f"  ... and {len(multi_aop_entities) - 5} more")
    
    def process_all(self) -> None:
        """Run the complete preprocessing pipeline."""
        print("Starting AOP data preprocessing...")
        
        # Process all data files
        self.process_mie_ao_data()
        self.process_ec_data()
        self.process_ker_data()
        
        # Merge duplicates and build indices
        self.merge_duplicate_entities()
        
        # Generate output files
        self.generate_clean_data_files()
        
        print("Preprocessing completed successfully!")


def main():
    """Main function to run the preprocessor."""
    # Get the directory containing the TSV files
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Initialize and run preprocessor
    preprocessor = AOPDataPreprocessor(script_dir)
    preprocessor.process_all()


if __name__ == "__main__":
    main()