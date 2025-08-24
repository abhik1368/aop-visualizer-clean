#!/usr/bin/env python3
"""
AOP Network Analysis with Publication-Quality Plots
Includes comprehensive analysis + visualization generation
"""

import os
import sys
import time
import json
import pandas as pd
import numpy as np
import networkx as nx
from pathlib import Path
from collections import defaultdict, Counter

# Try to import plotting libraries
try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    import seaborn as sns
    PLOTTING_AVAILABLE = True
    print("✓ Plotting libraries available")
except ImportError as e:
    print(f"Warning: Plotting libraries not available ({e})")
    PLOTTING_AVAILABLE = False

def create_output_directories():
    """Create necessary output directories"""
    directories = ['figures', 'results', 'reports']
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
    print("Output directories created")

def load_aop_data(data_path="data/"):
    """Load AOP data from TSV files"""
    print("Loading AOP data...")
    
    try:
        mie_ao_df = pd.read_csv(f"{data_path}aop_ke_mie_ao.tsv", sep='\t', 
                               names=['AOP', 'Event', 'Type', 'Label'])
        ker_df = pd.read_csv(f"{data_path}aop_ke_ker.tsv", sep='\t',
                            names=['AOP', 'Source', 'Target', 'Relationship', 
                                   'Adjacency', 'Confidence', 'Extra'])
        ec_df = pd.read_csv(f"{data_path}aop_ke_ec.tsv", sep='\t',
                           names=['AOP', 'Event', 'Change', 'Ontology', 'OntologyID',
                                  'OntologyTerm', 'SecondaryOntology', 'SecondaryID', 
                                  'SecondaryTerm'])
        
        print(f"Loaded {len(mie_ao_df)} events, {len(ker_df)} relationships")
        print(f"{mie_ao_df['AOP'].nunique()} unique AOPs, {mie_ao_df['Event'].nunique()} unique events")
        
        return mie_ao_df, ker_df, ec_df
    except Exception as e:
        print(f"Error loading data: {e}")
        return None, None, None

def build_aop_network(mie_ao_df, ker_df, ec_df):
    """Build NetworkX directed graph from AOP data"""
    print("Building network graph...")
    
    G = nx.DiGraph()
    
    # Create node attributes dictionary
    node_attrs = {}
    for _, row in mie_ao_df.iterrows():
        event_id = row['Event']
        node_attrs[event_id] = {
            'label': str(row['Label']) if pd.notna(row['Label']) else 'Unknown',
            'type': str(row['Type']) if pd.notna(row['Type']) else 'Unknown',
            'aop': str(row['AOP']) if pd.notna(row['AOP']) else 'Unknown'
        }
    
    # Add ontology information from EC data
    for _, row in ec_df.iterrows():
        event_id = row['Event']
        if event_id in node_attrs:
            node_attrs[event_id].update({
                'change': str(row['Change']) if pd.notna(row['Change']) else '',
                'ontology': str(row['Ontology']) if pd.notna(row['Ontology']) else '',
                'ontology_term': str(row['OntologyTerm']) if pd.notna(row['OntologyTerm']) else ''
            })
    
    # Add nodes to graph
    for node_id, attrs in node_attrs.items():
        G.add_node(node_id, **attrs)
    
    # Add edges from KER data
    edge_count = 0
    for _, row in ker_df.iterrows():
        try:
            source = row['Source']
            target = row['Target']
            
            if pd.notna(source) and pd.notna(target):
                source = str(int(source)) if isinstance(source, float) else str(source)
                target = str(int(target)) if isinstance(target, float) else str(target)
                
                if source in node_attrs and target in node_attrs:
                    G.add_edge(source, target, 
                               relationship=str(row['Relationship']) if pd.notna(row['Relationship']) else '',
                               adjacency=str(row['Adjacency']) if pd.notna(row['Adjacency']) else '',
                               confidence=str(row['Confidence']) if pd.notna(row['Confidence']) else '',
                               aop=str(row['AOP']) if pd.notna(row['AOP']) else '')
                    edge_count += 1
        except Exception as e:
            continue
    
    print(f"Network built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    print(f"{nx.number_weakly_connected_components(G)} connected components")
    
    return G

def calculate_network_metrics(G):
    """Calculate comprehensive network topology metrics"""
    print("Calculating network topology metrics...")
    
    metrics = {}
    
    try:
        metrics['degree_centrality'] = nx.degree_centrality(G)
        metrics['in_degree_centrality'] = nx.in_degree_centrality(G)
        metrics['out_degree_centrality'] = nx.out_degree_centrality(G)
        metrics['betweenness_centrality'] = nx.betweenness_centrality(G)
        metrics['pagerank'] = nx.pagerank(G, max_iter=1000)
        
        print("Network topology metrics calculated")
        return metrics
    except Exception as e:
        print(f"Error calculating metrics: {e}")
        return {}

def identify_critical_paths(G, metrics):
    """Identify critical paths from MIEs to AOs"""
    print("Identifying critical paths...")
    
    mies = [n for n in G.nodes() if 'MolecularInitiatingEvent' in G.nodes[n].get('type', '')]
    aos = [n for n in G.nodes() if 'AdverseOutcome' in G.nodes[n].get('type', '')]
    
    print(f"Found {len(mies)} MIEs and {len(aos)} AOs")
    
    critical_paths = []
    
    # Limit to avoid memory issues
    for mie in mies[:50]:
        for ao in aos[:50]:
            try:
                if nx.has_path(G, mie, ao):
                    path = nx.shortest_path(G, mie, ao)
                    path_betweenness = sum(metrics['betweenness_centrality'].get(n, 0) for n in path)
                    
                    critical_paths.append({
                        'mie': mie,
                        'ao': ao,
                        'path': path,
                        'length': len(path),
                        'importance': path_betweenness,
                        'mie_label': G.nodes[mie].get('label', 'Unknown'),
                        'ao_label': G.nodes[ao].get('label', 'Unknown')
                    })
            except:
                continue
    
    critical_paths.sort(key=lambda x: x['importance'], reverse=True)
    print(f"Found {len(critical_paths)} critical paths")
    return critical_paths

def identify_convergence_divergence_points(G, metrics):
    """Identify convergence and divergence points"""
    print("Identifying convergence and divergence points...")
    
    convergence_points = []
    divergence_points = []
    
    for node in G.nodes():
        try:
            in_degree = G.in_degree(node)
            out_degree = G.out_degree(node)
            
            if in_degree > 1 and out_degree <= in_degree:
                convergence_points.append({
                    'node': node,
                    'label': G.nodes[node].get('label', 'Unknown'),
                    'type': G.nodes[node].get('type', 'Unknown'),
                    'in_degree': in_degree,
                    'out_degree': out_degree,
                    'betweenness': metrics['betweenness_centrality'].get(node, 0)
                })
            
            if out_degree > 1 and in_degree <= out_degree:
                divergence_points.append({
                    'node': node,
                    'label': G.nodes[node].get('label', 'Unknown'),
                    'type': G.nodes[node].get('type', 'Unknown'),
                    'in_degree': in_degree,
                    'out_degree': out_degree,
                    'betweenness': metrics['betweenness_centrality'].get(node, 0)
                })
        except:
            continue
    
    convergence_points.sort(key=lambda x: x['betweenness'], reverse=True)
    divergence_points.sort(key=lambda x: x['betweenness'], reverse=True)
    
    print(f"Found {len(convergence_points)} convergence and {len(divergence_points)} divergence points")
    return convergence_points, divergence_points

def create_publication_plots(G, metrics, critical_paths, convergence_points, divergence_points):
    """Create publication-quality plots"""
    if not PLOTTING_AVAILABLE:
        print("Skipping plots - matplotlib not available")
        return
    
    print("Creating publication-quality plots...")
    
    # Set publication style
    plt.style.use('default')
    plt.rcParams.update({
        'figure.figsize': (12, 8),
        'font.size': 12,
        'axes.labelsize': 14,
        'axes.titlesize': 16,
        'xtick.labelsize': 12,
        'ytick.labelsize': 12,
        'legend.fontsize': 12,
        'savefig.dpi': 300,
        'savefig.bbox': 'tight'
    })
    
    # Color scheme
    colors = {
        'primary': '#2E86AB',
        'secondary': '#A23B72',
        'accent': '#F18F01',
        'success': '#2E8B57'
    }
    
    # Plot 1: Network Overview
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
    
    # 1A: Degree distribution
    degrees = [G.degree(n) for n in G.nodes()]
    ax1.hist(degrees, bins=30, color=colors['primary'], alpha=0.7, edgecolor='black')
    ax1.set_xlabel('Node Degree')
    ax1.set_ylabel('Frequency')
    ax1.set_title('Degree Distribution')
    ax1.grid(True, alpha=0.3)
    ax1.axvline(np.mean(degrees), color='red', linestyle='--', 
               label=f'Mean: {np.mean(degrees):.1f}')
    ax1.legend()
    
    # 1B: Betweenness distribution
    betweenness_values = list(metrics['betweenness_centrality'].values())
    ax2.hist(betweenness_values, bins=30, color=colors['secondary'], alpha=0.7, edgecolor='black')
    ax2.set_xlabel('Betweenness Centrality')
    ax2.set_ylabel('Frequency')
    ax2.set_title('Betweenness Centrality Distribution')
    ax2.grid(True, alpha=0.3)
    
    # 1C: Node type distribution
    type_counts = Counter([G.nodes[n].get('type', 'Unknown') for n in G.nodes()])
    types, counts = zip(*type_counts.most_common())
    ax3.bar(range(len(types)), counts, color=[colors['primary'], colors['accent'], colors['success']], alpha=0.8)
    ax3.set_xticks(range(len(types)))
    ax3.set_xticklabels([t.replace('MolecularInitiatingEvent', 'MIE').replace('AdverseOutcome', 'AO') 
                        for t in types], rotation=45)
    ax3.set_ylabel('Count')
    ax3.set_title('Node Type Distribution')
    ax3.grid(True, alpha=0.3, axis='y')
    
    # 1D: Critical path length distribution
    if critical_paths:
        path_lengths = [p['length'] for p in critical_paths]
        ax4.hist(path_lengths, bins=20, color=colors['accent'], alpha=0.7, edgecolor='black')
        ax4.set_xlabel('Path Length')
        ax4.set_ylabel('Frequency')
        ax4.set_title('Critical Path Length Distribution')
        ax4.grid(True, alpha=0.3)
        ax4.axvline(np.mean(path_lengths), color='red', linestyle='--',
                   label=f'Mean: {np.mean(path_lengths):.1f}')
        ax4.legend()
    
    plt.tight_layout()
    plt.savefig('figures/network_overview.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    # Plot 2: Top nodes analysis
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(20, 8))
    
    # Top betweenness centrality nodes
    nodes_data = [(node, metrics['betweenness_centrality'][node], 
                   G.nodes[node].get('label', 'Unknown')[:40]) 
                  for node in G.nodes()]
    nodes_data.sort(key=lambda x: x[1], reverse=True)
    
    top_15 = nodes_data[:15]
    labels = [item[2] for item in top_15]
    values = [item[1] for item in top_15]
    
    bars1 = ax1.barh(range(len(labels)), values, color=colors['primary'], alpha=0.8)
    ax1.set_yticks(range(len(labels)))
    ax1.set_yticklabels(labels, fontsize=10)
    ax1.set_xlabel('Betweenness Centrality')
    ax1.set_title('Top 15 Nodes by Betweenness Centrality')
    ax1.grid(True, alpha=0.3, axis='x')
    
    # Convergence vs Divergence comparison
    if convergence_points and divergence_points:
        conv_top10 = [p['betweenness'] for p in convergence_points[:10]]
        div_top10 = [p['betweenness'] for p in divergence_points[:10]]
        
        ax2.scatter(range(len(conv_top10)), conv_top10, 
                   color=colors['success'], s=100, alpha=0.7, label='Convergence Points')
        ax2.scatter(range(len(div_top10)), div_top10, 
                   color=colors['secondary'], s=100, alpha=0.7, label='Divergence Points')
        
        ax2.set_xlabel('Rank')
        ax2.set_ylabel('Betweenness Centrality')
        ax2.set_title('Top 10 Convergence vs Divergence Points')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('figures/top_nodes_analysis.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    # Plot 3: Critical paths analysis
    if critical_paths:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
        
        # Path importance vs length
        lengths = [p['length'] for p in critical_paths]
        importances = [p['importance'] for p in critical_paths]
        
        ax1.scatter(lengths, importances, alpha=0.6, color=colors['accent'], s=60)
        ax1.set_xlabel('Path Length')
        ax1.set_ylabel('Path Importance')
        ax1.set_title('Critical Paths: Length vs Importance')
        ax1.grid(True, alpha=0.3)
        
        # Top 10 critical paths
        top_paths = critical_paths[:10]
        path_labels = [f"{p['mie_label'][:15]}→{p['ao_label'][:15]}" for p in top_paths]
        path_importances = [p['importance'] for p in top_paths]
        
        bars = ax2.barh(range(len(path_labels)), path_importances, 
                       color=colors['secondary'], alpha=0.8)
        ax2.set_yticks(range(len(path_labels)))
        ax2.set_yticklabels(path_labels, fontsize=9)
        ax2.set_xlabel('Path Importance')
        ax2.set_title('Top 10 Critical Paths')
        ax2.grid(True, alpha=0.3, axis='x')
        
        plt.tight_layout()
        plt.savefig('figures/critical_paths_analysis.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    print(f"Publication-quality plots saved to figures/")

def generate_comprehensive_report(G, metrics, critical_paths, convergence_points, divergence_points):
    """Generate comprehensive analysis report"""
    print("\n" + "="*80)
    print("COMPREHENSIVE AOP NETWORK ANALYSIS REPORT")
    print("Based on Villeneuve et al. (2018) Methodology")
    print("="*80)
    
    # Network Overview
    print(f"\n1. NETWORK OVERVIEW")
    print(f"   Nodes: {G.number_of_nodes()}")
    print(f"   Edges: {G.number_of_edges()}")
    print(f"   Density: {nx.density(G):.4f}")
    print(f"   Connected Components: {nx.number_weakly_connected_components(G)}")
    
    # Node type distribution
    type_counts = Counter([G.nodes[n].get('type', 'Unknown') for n in G.nodes()])
    print(f"\n2. NODE TYPE DISTRIBUTION")
    for node_type, count in type_counts.most_common():
        print(f"   {node_type}: {count}")
    
    # Top nodes by centrality
    print(f"\n3. TOP NODES BY BETWEENNESS CENTRALITY")
    if metrics.get('betweenness_centrality'):
        nodes_data = [(node, metrics['betweenness_centrality'][node], 
                       G.nodes[node].get('label', 'Unknown')) 
                      for node in G.nodes()]
        nodes_data.sort(key=lambda x: x[1], reverse=True)
        
        for i, (node, betweenness, label) in enumerate(nodes_data[:10]):
            print(f"   {i+1:2d}. {label[:60]:60s} ({betweenness:.6f})")
    
    # Critical paths
    print(f"\n4. CRITICAL PATHS ANALYSIS")
    print(f"   Total paths found: {len(critical_paths)}")
    if critical_paths:
        lengths = [p['length'] for p in critical_paths]
        print(f"   Average path length: {np.mean(lengths):.2f}")
        print(f"   Path length range: {min(lengths)} - {max(lengths)}")
        print(f"   Top 5 critical paths:")
        for i, path in enumerate(critical_paths[:5]):
            print(f"   {i+1}. {path['mie_label'][:30]:30s} -> {path['ao_label'][:30]:30s} "
                  f"(Length: {path['length']}, Importance: {path['importance']:.4f})")
    
    # Convergence/Divergence
    print(f"\n5. CONVERGENCE/DIVERGENCE ANALYSIS")
    print(f"   Convergence points: {len(convergence_points)}")
    print(f"   Divergence points: {len(divergence_points)}")
    
    if convergence_points:
        print(f"   Top 5 convergence points:")
        for i, point in enumerate(convergence_points[:5]):
            print(f"   {i+1}. {point['label'][:50]:50s} "
                  f"(In: {point['in_degree']}, Out: {point['out_degree']})")
    
    if divergence_points:
        print(f"   Top 5 divergence points:")
        for i, point in enumerate(divergence_points[:5]):
            print(f"   {i+1}. {point['label'][:50]:50s} "
                  f"(In: {point['in_degree']}, Out: {point['out_degree']})")
    
    print(f"\n{'='*80}")
    
    # Save results
    results = {
        'network_stats': {
            'nodes': G.number_of_nodes(),
            'edges': G.number_of_edges(),
            'density': nx.density(G),
            'components': nx.number_weakly_connected_components(G)
        },
        'node_types': dict(type_counts),
        'critical_paths_summary': {
            'total_paths': len(critical_paths),
            'avg_length': float(np.mean([p['length'] for p in critical_paths])) if critical_paths else 0,
            'top_paths': critical_paths[:10] if critical_paths else []
        },
        'convergence_summary': {
            'total_convergence': len(convergence_points),
            'total_divergence': len(divergence_points),
            'top_convergence': convergence_points[:10] if convergence_points else [],
            'top_divergence': divergence_points[:10] if divergence_points else []
        }
    }
    
    with open('results/aop_network_analysis_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nResults saved to: results/aop_network_analysis_results.json")
    return results

def main():
    """Main analysis function with plotting"""
    print("COMPREHENSIVE AOP NETWORK ANALYSIS WITH PLOTS")
    print("Based on Villeneuve et al. (2018) - Environmental Toxicology and Chemistry")
    print("=" * 80)
    
    start_time = time.time()
    create_output_directories()
    
    try:
        # Load data and build network
        mie_ao_df, ker_df, ec_df = load_aop_data("data/")
        if mie_ao_df is None:
            raise Exception("Failed to load data files")
        
        G = build_aop_network(mie_ao_df, ker_df, ec_df)
        metrics = calculate_network_metrics(G)
        critical_paths = identify_critical_paths(G, metrics)
        convergence_points, divergence_points = identify_convergence_divergence_points(G, metrics)
        
        # Create plots
        create_publication_plots(G, metrics, critical_paths, convergence_points, divergence_points)
        
        # Generate report
        results = generate_comprehensive_report(G, metrics, critical_paths, 
                                              convergence_points, divergence_points)
        
        # Summary
        end_time = time.time()
        execution_time = end_time - start_time
        
        print(f"\nANALYSIS COMPLETE!")
        print(f"Total execution time: {execution_time:.2f} seconds")
        print(f"Results saved to:")
        print(f"  - Analysis: results/aop_network_analysis_results.json")
        if PLOTTING_AVAILABLE:
            print(f"  - Plots: figures/network_overview.png")
            print(f"  - Plots: figures/top_nodes_analysis.png")
            print(f"  - Plots: figures/critical_paths_analysis.png")
        
        return results
        
    except Exception as e:
        print(f"\nError during analysis: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    results = main()