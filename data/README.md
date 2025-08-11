# AOP Data Files

This directory contains the core data files for the AOP Network Visualizer.

## Files

### aop_ke_ec.tsv
Key Events and Event Components data containing:
- Event IDs and descriptions
- Component relationships
- Biological context information

### aop_ke_ker.tsv  
Key Event Relationships data containing:
- Source and target event relationships
- Relationship types and evidence
- Pathway connectivity information

### aop_ke_mie_ao.tsv
Molecular Initiating Events (MIE) and Adverse Outcomes (AO) mappings containing:
- AOP pathway definitions
- MIE to AO connections
- Pathway metadata

## Data Format

All files are in Tab-Separated Values (TSV) format with headers in the first row.

## Usage

These files are automatically loaded by the backend API and processed to create the network visualizations. The data is parsed to extract:
- Nodes (MIE, Key Events, Adverse Outcomes)
- Edges (relationships between events)
- Metadata (descriptions, types, evidence levels)

## Data Sources

The data represents curated Adverse Outcome Pathways from toxicology research, formatted for network analysis and visualization.

