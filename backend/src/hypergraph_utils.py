"""
Hypergraph utilities for AOP Network Visualizer
Provides community detection, node grouping, and hypergraph construction
"""

import numpy as np
import networkx as nx
from collections import defaultdict, Counter
import json
from typing import Dict, List, Tuple, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HypergraphProcessor:
    """Main class for hypergraph processing and community detection"""
    
    def __init__(self):
        self.graph = None
        self.communities = None
        self.node_communities = {}
        
    def build_networkx_graph(self, nodes: List[Dict], edges: List[Dict]) -> nx.Graph:
        """Build NetworkX graph from node and edge data"""
        G = nx.Graph()
        
        # Add nodes with attributes
        for node in nodes:
            G.add_node(
                node['id'], 
                label=node.get('label', ''),
                type=node.get('type', 'Unknown'),
                aop=node.get('aop', ''),
                ontology=node.get('ontology', ''),
                ontology_term=node.get('ontology_term', ''),
                change=node.get('change', '')
            )
        
        # Add edges with weights
        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target and G.has_node(source) and G.has_node(target):
                # Calculate edge weight based on confidence and adjacency
                weight = 1.0
                if edge.get('confidence'):
                    try:
                        confidence = float(edge['confidence'])
                        weight *= confidence
                    except (ValueError, TypeError):
                        pass
                
                if edge.get('adjacency'):
                    try:
                        adjacency = float(edge['adjacency'])
                        weight *= adjacency
                    except (ValueError, TypeError):
                        pass
                
                G.add_edge(
                    source, 
                    target, 
                    weight=weight,
                    relationship=edge.get('relationship', ''),
                    aop=edge.get('aop', ''),
                    confidence=edge.get('confidence', ''),
                    adjacency=edge.get('adjacency', '')
                )
        
        self.graph = G
        logger.info(f"Built NetworkX graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        return G
    
    def detect_communities_louvain(self, resolution: float = 1.0) -> Dict[str, Any]:
        """Detect communities using Louvain algorithm"""
        if not self.graph:
            raise ValueError("Graph not initialized. Call build_networkx_graph first.")
        
        try:
            # Use NetworkX's Louvain implementation
            communities = nx.community.louvain_communities(self.graph, resolution=resolution)
            
            # Calculate modularity
            modularity = nx.community.modularity(self.graph, communities)
            
            # Convert to our format
            community_list = []
            node_to_community = {}
            
            for i, community in enumerate(communities):
                community_nodes = list(community)
                community_list.append({
                    'id': i,
                    'members': community_nodes,
                    'size': len(community_nodes),
                    'modularity_contribution': 0  # Could calculate individual contribution
                })
                
                for node in community_nodes:
                    node_to_community[node] = i
            
            self.communities = community_list
            self.node_communities = node_to_community
            
            logger.info(f"Louvain: Found {len(communities)} communities, modularity: {modularity:.3f}")
            
            return {
                'method': 'louvain',
                'communities': community_list,
                'modularity': modularity,
                'node_communities': node_to_community,
                'num_communities': len(communities)
            }
            
        except Exception as e:
            logger.error(f"Louvain community detection failed: {e}")
            return self._fallback_community_detection()
    
    def detect_communities_leiden(self, resolution: float = 1.0) -> Dict[str, Any]:
        """Detect communities using Leiden algorithm (simplified implementation)"""
        if not self.graph:
            raise ValueError("Graph not initialized")
        
        try:
            # For now, use Louvain as Leiden requires additional dependencies
            # In production, you would install python-igraph and leidenalg
            logger.warning("Leiden algorithm not available, falling back to Louvain")
            return self.detect_communities_louvain(resolution)
            
        except Exception as e:
            logger.error(f"Leiden community detection failed: {e}")
            return self._fallback_community_detection()
    
    def detect_communities_walktrap(self, steps: int = 4) -> Dict[str, Any]:
        """Detect communities using random walk-based method"""
        if not self.graph:
            raise ValueError("Graph not initialized")
        
        try:
            # Simplified walktrap using NetworkX
            # Use edge betweenness as a proxy for walktrap
            communities = nx.community.girvan_newman(self.graph)
            
            # Take the first partition that gives reasonable number of communities
            best_partition = None
            best_modularity = -1
            
            for partition in communities:
                if len(partition) > len(self.graph.nodes()) // 10:  # Stop if too many small communities
                    break
                    
                modularity = nx.community.modularity(self.graph, partition)
                if modularity > best_modularity:
                    best_modularity = modularity
                    best_partition = partition
            
            if not best_partition:
                return self._fallback_community_detection()
            
            # Convert to our format
            community_list = []
            node_to_community = {}
            
            for i, community in enumerate(best_partition):
                community_nodes = list(community)
                community_list.append({
                    'id': i,
                    'members': community_nodes,
                    'size': len(community_nodes)
                })
                
                for node in community_nodes:
                    node_to_community[node] = i
            
            logger.info(f"Walktrap: Found {len(community_list)} communities, modularity: {best_modularity:.3f}")
            
            return {
                'method': 'walktrap',
                'communities': community_list,
                'modularity': best_modularity,
                'node_communities': node_to_community,
                'num_communities': len(community_list)
            }
            
        except Exception as e:
            logger.error(f"Walktrap community detection failed: {e}")
            return self._fallback_community_detection()
    
    def detect_communities_spectral(self, k: Optional[int] = None) -> Dict[str, Any]:
        """Detect communities using spectral clustering"""
        if not self.graph:
            raise ValueError("Graph not initialized")
        
        try:
            from sklearn.cluster import SpectralClustering
            
            # Get adjacency matrix
            adj_matrix = nx.adjacency_matrix(self.graph).toarray()
            
            # Estimate number of clusters if not provided
            if k is None:
                # Use eigengap heuristic
                eigenvals = np.linalg.eigvals(adj_matrix)
                eigenvals = np.sort(eigenvals)[::-1]
                gaps = np.diff(eigenvals)
                k = np.argmax(gaps) + 1
                k = max(2, min(k, len(self.graph.nodes()) // 5))  # Reasonable bounds
            
            # Apply spectral clustering
            clustering = SpectralClustering(n_clusters=k, affinity='precomputed', random_state=42)
            labels = clustering.fit_predict(adj_matrix)
            
            # Convert to our format
            communities_dict = defaultdict(list)
            for node, label in zip(self.graph.nodes(), labels):
                communities_dict[label].append(node)
            
            community_list = []
            node_to_community = {}
            
            for i, (label, members) in enumerate(communities_dict.items()):
                community_list.append({
                    'id': i,
                    'members': members,
                    'size': len(members)
                })
                
                for node in members:
                    node_to_community[node] = i
            
            # Calculate modularity
            communities_nx = [set(comm['members']) for comm in community_list]
            modularity = nx.community.modularity(self.graph, communities_nx)
            
            logger.info(f"Spectral: Found {len(community_list)} communities, modularity: {modularity:.3f}")
            
            return {
                'method': 'spectral',
                'communities': community_list,
                'modularity': modularity,
                'node_communities': node_to_community,
                'num_communities': len(community_list)
            }
            
        except ImportError:
            logger.warning("sklearn not available for spectral clustering, falling back to Louvain")
            return self.detect_communities_louvain()
        except Exception as e:
            logger.error(f"Spectral community detection failed: {e}")
            return self._fallback_community_detection()
    
    def _fallback_community_detection(self) -> Dict[str, Any]:
        """Fallback community detection using simple connected components"""
        if not self.graph:
            return {'method': 'none', 'communities': [], 'modularity': 0, 'node_communities': {}}
        
        try:
            components = list(nx.connected_components(self.graph))
            
            community_list = []
            node_to_community = {}
            
            for i, component in enumerate(components):
                community_nodes = list(component)
                community_list.append({
                    'id': i,
                    'members': community_nodes,
                    'size': len(community_nodes)
                })
                
                for node in community_nodes:
                    node_to_community[node] = i
            
            # Calculate modularity
            communities_nx = [set(comm['members']) for comm in community_list]
            modularity = nx.community.modularity(self.graph, communities_nx) if len(communities_nx) > 1 else 0
            
            logger.info(f"Fallback: Found {len(community_list)} connected components")
            
            return {
                'method': 'connected_components',
                'communities': community_list,
                'modularity': modularity,
                'node_communities': node_to_community,
                'num_communities': len(community_list)
            }
            
        except Exception as e:
            logger.error(f"Fallback community detection failed: {e}")
            return {'method': 'error', 'communities': [], 'modularity': 0, 'node_communities': {}}
    
    def group_nodes_by_type(self, nodes: List[Dict], min_group_size: int = 4) -> Dict[str, Any]:
        """Group nodes by their type for hyperedge creation"""
        type_groups = defaultdict(list)
        
        for node in nodes:
            node_type = node.get('type', 'Unknown')
            type_groups[node_type].append(node)
        
        # Filter groups by minimum size
        valid_groups = {}
        for node_type, group_nodes in type_groups.items():
            if len(group_nodes) >= min_group_size:
                valid_groups[node_type] = {
                    'type': node_type,
                    'members': [node['id'] for node in group_nodes],
                    'size': len(group_nodes),
                    'nodes': group_nodes
                }
        
        logger.info(f"Node grouping: {len(valid_groups)} valid groups from {len(type_groups)} total types")
        
        return {
            'groups': valid_groups,
            'total_types': len(type_groups),
            'valid_groups': len(valid_groups),
            'min_group_size': min_group_size
        }
    
    def create_hypergraph_elements(self, nodes: List[Dict], edges: List[Dict], 
                                 min_nodes: int = 4, use_communities: bool = True,
                                 use_type_groups: bool = True, community_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Create hypergraph elements including hypernodes and hyperedges"""
        
        hypernodes = []
        hyperedges = []
        hypernode_connections = []
        # Consistent colors for type-based hypernodes: same type -> same color
        # Match frontend pastel palette (memory: KE=#93c5fd, MIE=#86efac, AO=#f9a8d4)
        type_group_colors = {
            'MOLECULARINITIATINGEVENT': '#86efac',  # MIE
            'MIE': '#86efac',
            'KEYEVENT': '#93c5fd',                 # KE
            'KEY_EVENT': '#93c5fd',
            'KE': '#93c5fd',
            'ADVERSEOUTCOME': '#f9a8d4',           # AO
            'AO': '#f9a8d4',
        }
        # Types we should never create type-hypernodes for (even if present)
        disallowed_type_groups = {
            'KEY_EVENT_RELATIONSHIP',
            'WEIGHT_OF_EVIDENCE', 'WOE',
            'TISSUE', 'ORGAN'
        }
        
        # Create type-based hypernodes
        if use_type_groups:
            type_groups = self.group_nodes_by_type(nodes, min_nodes)
            
            for group_type, group_data in type_groups['groups'].items():
                group_key = str(group_type).replace(' ', '').upper()
                if group_key in disallowed_type_groups:
                    # Skip unwanted group types entirely
                    continue
                hypernode_id = f"type-hypernode-{group_type}"
                
                hypernode = {
                    'id': hypernode_id,
                    'label': f"{group_type} Group ({group_data['size']})",
                    'type': 'type-hypernode',
                    'original_type': group_type,
                    'color': type_group_colors.get(group_key),
                    'member_count': group_data['size'],
                    'members': group_data['members']
                }
                
                hypernodes.append(hypernode)
                
                # Create connections from members to hypernode
                for member_id in group_data['members']:
                    hypernode_connections.append({
                        'id': f"{member_id}-{hypernode_id}",
                        'source': member_id,
                        'target': hypernode_id,
                        'type': 'hypernode-connection',
                        'weight': 0.5
                    })
        
        # Create community-based hypernodes
        if use_communities and community_data and community_data.get('communities'):
            # Build a quick lookup for node types
            node_by_id = {n['id']: n for n in nodes}
            for i, community in enumerate(community_data['communities']):
                if community['size'] >= min_nodes:
                    hypernode_id = f"community-hypernode-{i}"
                    # Determine dominant type in this community
                    type_counts = Counter()
                    for member_id in community['members']:
                        n = node_by_id.get(member_id)
                        if not n:
                            continue
                        t = str(n.get('type', 'Unknown')).replace(' ', '').upper()
                        type_counts[t] += 1
                    dominant_type_key = None
                    dominant_type = None
                    if type_counts:
                        dominant_type_key, _ = type_counts.most_common(1)[0]
                        # Map back to a readable label if possible
                        if dominant_type_key in ('KEYEVENT', 'KEY_EVENT', 'KE'):
                            dominant_type = 'KeyEvent'
                        elif dominant_type_key in ('MOLECULARINITIATINGEVENT', 'MIE'):
                            dominant_type = 'MolecularInitiatingEvent'
                        elif dominant_type_key in ('ADVERSEOUTCOME', 'AO'):
                            dominant_type = 'AdverseOutcome'
                        else:
                            dominant_type = dominant_type_key
                    color = type_group_colors.get(dominant_type_key)
                    
                    hypernode = {
                        'id': hypernode_id,
                        'label': f"Community {i+1} ({community['size']})",
                        'type': 'community-hypernode',
                        'member_count': community['size'],
                        'members': community['members'],
                        'modularity_contribution': community.get('modularity_contribution', 0),
                        'dominant_type': dominant_type,
                        'type_distribution': dict(type_counts),
                        'color': color,
                    }
                    
                    hypernodes.append(hypernode)
                    
                    # Create connections from members to hypernode
                    for member_id in community['members']:
                        hypernode_connections.append({
                            'id': f"{member_id}-{hypernode_id}",
                            'source': member_id,
                            'target': hypernode_id,
                            'type': 'community-connection',
                            'weight': 0.3
                        })
        
        # Calculate statistics
        stats = {
            'original_nodes': len(nodes),
            'original_edges': len(edges),
            'hypernodes': len(hypernodes),
            'hypernode_connections': len(hypernode_connections),
            'total_nodes': len(nodes) + len(hypernodes),
            'total_edges': len(edges) + len(hypernode_connections)
        }
        
        logger.info(f"Hypergraph creation: {stats['hypernodes']} hypernodes, {stats['hypernode_connections']} connections")
        
        return {
            'hypernodes': hypernodes,
            'hypernode_connections': hypernode_connections,
            'stats': stats,
            'config': {
                'min_nodes': min_nodes,
                'use_communities': use_communities,
                'use_type_groups': use_type_groups,
                'type_group_colors': type_group_colors
            }
        }
    
    def get_community_colors(self, method: str = 'louvain') -> Dict[str, str]:
        """Generate colors for community visualization"""
        if not self.node_communities:
            return {}
        
        # Color palette for communities
        colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
            '#f8c471', '#82e0aa', '#aed6f1', '#f1948a', '#85c1e9'
        ]
        
        node_colors = {}
        for node_id, community_id in self.node_communities.items():
            color_index = community_id % len(colors)
            node_colors[node_id] = colors[color_index]
        
        return node_colors
    
    def analyze_network_properties(self) -> Dict[str, Any]:
        """Analyze basic network properties"""
        if not self.graph:
            return {}
        
        try:
            properties = {
                'nodes': self.graph.number_of_nodes(),
                'edges': self.graph.number_of_edges(),
                'density': nx.density(self.graph),
                'connected_components': nx.number_connected_components(self.graph),
                'average_clustering': nx.average_clustering(self.graph),
                'transitivity': nx.transitivity(self.graph)
            }
            
            # Degree statistics
            degrees = dict(self.graph.degree())
            if degrees:
                degree_values = list(degrees.values())
                properties.update({
                    'average_degree': np.mean(degree_values),
                    'max_degree': max(degree_values),
                    'min_degree': min(degree_values),
                    'degree_std': np.std(degree_values)
                })
            
            # Centrality measures (for smaller graphs)
            if self.graph.number_of_nodes() < 1000:
                try:
                    betweenness = nx.betweenness_centrality(self.graph)
                    closeness = nx.closeness_centrality(self.graph)
                    
                    properties.update({
                        'avg_betweenness_centrality': np.mean(list(betweenness.values())),
                        'avg_closeness_centrality': np.mean(list(closeness.values()))
                    })
                except:
                    pass  # Skip if computation is too expensive
            
            return properties
            
        except Exception as e:
            logger.error(f"Network analysis failed: {e}")
            return {'error': str(e)}

def detect_communities(nodes: List[Dict], edges: List[Dict], method: str = 'louvain', **kwargs) -> Dict[str, Any]:
    """Convenience function for community detection"""
    processor = HypergraphProcessor()
    processor.build_networkx_graph(nodes, edges)
    
    method_map = {
        'louvain': processor.detect_communities_louvain,
        'leiden': processor.detect_communities_leiden,
        'walktrap': processor.detect_communities_walktrap,
        'spectral': processor.detect_communities_spectral
    }
    
    if method not in method_map:
        logger.warning(f"Unknown method {method}, falling back to louvain")
        method = 'louvain'
    
    return method_map[method](**kwargs)

def create_hypergraph(nodes: List[Dict], edges: List[Dict], min_nodes: int = 4, 
                     community_method: str = 'louvain', **kwargs) -> Dict[str, Any]:
    """Convenience function for hypergraph creation"""
    processor = HypergraphProcessor()
    processor.build_networkx_graph(nodes, edges)
    
    # Detect communities
    community_data = detect_communities(nodes, edges, community_method)
    
    # Create hypergraph elements
    hypergraph_data = processor.create_hypergraph_elements(
        nodes, edges, min_nodes=min_nodes, 
        community_data=community_data, **kwargs
    )
    
    # Add community data and network properties
    hypergraph_data['community_data'] = community_data
    hypergraph_data['network_properties'] = processor.analyze_network_properties()
    hypergraph_data['node_colors'] = processor.get_community_colors(community_method)
    
    return hypergraph_data
