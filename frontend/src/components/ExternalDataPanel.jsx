import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, BookOpen, Search, Loader2 } from 'lucide-react';
import axios from 'axios';

const ExternalDataPanel = ({ searchTerm, onClose }) => {
  const [publications, setPublications] = useState([]);
  const [diseaseInfo, setDiseaseInfo] = useState(null);
  const [loadingPubs, setLoadingPubs] = useState(false);
  const [loadingDisease, setLoadingDisease] = useState(false);
  const [activeTab, setActiveTab] = useState('publications');

  const searchPublications = async (term = searchTerm) => {
    if (!term) return;
    
    setLoadingPubs(true);
    try {
      const response = await axios.get('/api/pubmed_search', {
        params: {
          q: term,
          max_results: 10
        }
      });
      setPublications(response.data.publications || []);
    } catch (error) {
      console.error('Error searching publications:', error);
      setPublications([]);
    } finally {
      setLoadingPubs(false);
    }
  };

  const searchDiseaseInfo = async (term = searchTerm) => {
    if (!term) return;
    
    setLoadingDisease(true);
    try {
      const response = await axios.get('/api/disease_info', {
        params: {
          term: term
        }
      });
      setDiseaseInfo(response.data);
    } catch (error) {
      console.error('Error searching disease info:', error);
      setDiseaseInfo(null);
    } finally {
      setLoadingDisease(false);
    }
  };

  React.useEffect(() => {
    if (searchTerm) {
      if (activeTab === 'publications') {
        searchPublications();
      } else if (activeTab === 'disease') {
        searchDiseaseInfo();
      }
    }
  }, [searchTerm, activeTab]);

  const formatAuthors = (authors) => {
    if (!authors || authors.length === 0) return 'Unknown authors';
    if (authors.length <= 3) return authors.join(', ');
    return `${authors.slice(0, 3).join(', ')} et al.`;
  };

  return (
    <Card className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">External Resources</h3>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            ×
          </Button>
        )}
      </div>

      {searchTerm && (
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm font-medium">Searching for:</div>
          <div className="text-sm text-muted-foreground">{searchTerm}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'publications' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('publications')}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Publications
        </Button>
        <Button
          variant={activeTab === 'disease' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('disease')}
        >
          <Search className="h-4 w-4 mr-2" />
          Disease Info
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Publications Tab */}
        {activeTab === 'publications' && (
          <div className="space-y-4">
            {loadingPubs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Searching PubMed...
              </div>
            ) : publications.length > 0 ? (
              <div className="space-y-3">
                {publications.map((pub, index) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm leading-tight">
                        {pub.title}
                      </h4>
                      
                      <div className="text-xs text-muted-foreground">
                        {formatAuthors(pub.authors)} • {pub.journal} • {pub.year}
                      </div>
                      
                      {pub.abstract && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {pub.abstract}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 pt-2">
                        <Badge variant="secondary" className="text-xs">
                          PMID: {pub.pmid}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(pub.pubmed_url, '_blank')}
                          className="h-6 text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          PubMed
                        </Button>
                        {pub.doi && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://doi.org/${pub.doi}`, '_blank')}
                            className="h-6 text-xs"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            DOI
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {searchTerm ? 'No publications found' : 'Enter a search term to find publications'}
              </div>
            )}
          </div>
        )}

        {/* Disease Info Tab */}
        {activeTab === 'disease' && (
          <div className="space-y-4">
            {loadingDisease ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Searching disease databases...
              </div>
            ) : diseaseInfo ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Disease Information</h4>
                  <div className="text-sm text-muted-foreground mb-2">
                    Search term: {diseaseInfo.disease_term}
                  </div>
                </div>

                {diseaseInfo.sources && Object.keys(diseaseInfo.sources).length > 0 ? (
                  <div className="space-y-4">
                    {/* MeSH Information */}
                    {diseaseInfo.sources.mesh && (
                      <Card className="p-3">
                        <h5 className="font-medium text-sm mb-2">MeSH (Medical Subject Headings)</h5>
                        <div className="text-xs space-y-1">
                          {diseaseInfo.sources.mesh.found ? (
                            <div>
                              <div className="text-muted-foreground">
                                {diseaseInfo.sources.mesh.description}
                              </div>
                              {diseaseInfo.sources.mesh.mesh_ids && (
                                <div className="mt-2">
                                  <span className="font-medium">MeSH IDs: </span>
                                  {diseaseInfo.sources.mesh.mesh_ids.join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No MeSH terms found</div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* OMIM Information */}
                    {diseaseInfo.sources.omim && (
                      <Card className="p-3">
                        <h5 className="font-medium text-sm mb-2">OMIM (Online Mendelian Inheritance in Man)</h5>
                        <div className="text-xs space-y-2">
                          <div className="text-muted-foreground">
                            {diseaseInfo.sources.omim.description}
                          </div>
                          {diseaseInfo.sources.omim.omim_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(diseaseInfo.sources.omim.omim_url, '_blank')}
                              className="h-6 text-xs"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Search OMIM
                            </Button>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* Publications */}
                    {diseaseInfo.sources.publications && (
                      <Card className="p-3">
                        <h5 className="font-medium text-sm mb-2">Related Publications</h5>
                        <div className="text-xs space-y-2">
                          {diseaseInfo.sources.publications.found ? (
                            <div>
                              <div className="text-muted-foreground mb-2">
                                Found {diseaseInfo.sources.publications.pmid_count} related publications
                              </div>
                              {diseaseInfo.sources.publications.recent_pmids && (
                                <div className="space-y-1">
                                  <div className="font-medium">Recent PMIDs:</div>
                                  <div className="text-muted-foreground">
                                    {diseaseInfo.sources.publications.recent_pmids.join(', ')}
                                  </div>
                                </div>
                              )}
                              {diseaseInfo.sources.publications.pubmed_search_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(diseaseInfo.sources.publications.pubmed_search_url, '_blank')}
                                  className="h-6 text-xs mt-2"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View in PubMed
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No related publications found</div>
                          )}
                        </div>
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No disease information found
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                {searchTerm ? 'No disease information found' : 'Enter a search term to find disease information'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {searchTerm && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchPublications()}
              disabled={loadingPubs}
              className="flex-1"
            >
              {loadingPubs ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <BookOpen className="h-4 w-4 mr-2" />
              )}
              Refresh Publications
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => searchDiseaseInfo()}
              disabled={loadingDisease}
              className="flex-1"
            >
              {loadingDisease ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Refresh Disease Info
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ExternalDataPanel;

