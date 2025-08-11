# Perplexity API Setup Guide

## 1. Get Your Perplexity API Key

1. Go to [Perplexity AI API](https://docs.perplexity.ai/)
2. Sign up for an account if you don't have one
3. Navigate to your API dashboard
4. Generate a new API key

## 2. Configure the Environment

1. Open the `.env` file in the `backend` folder
2. Replace `your_perplexity_api_key_here` with your actual API key:
   ```
   PERPLEXITY_API_KEY=pplx-your-actual-api-key-here
   ```

## 3. Install Dependencies

Run in the backend directory:
```bash
pip install -r requirements.txt
```

## 4. Start the Backend Server

```bash
cd backend/src
python main.py
```

## Features

- **Perplexity Sonar Model**: Uses `llama-3.1-sonar-large-128k-online` for web-enabled analysis
- **Scientific Domain Search**: Filters to academic sources (PubMed, Nature, Science, etc.)
- **Citation Support**: Returns references and links to source materials
- **AOP-Specific Prompting**: Tailored for toxicology and molecular biology analysis
- **Comprehensive Analysis**: Covers mechanisms, significance, research context, and regulatory implications

## API Endpoint

- **POST** `/perplexity_analysis`
- **Body**: 
  ```json
  {
    "selected_nodes": [array of node objects],
    "query": "Your analysis question",
    "include_web_search": true
  }
  ```
- **Response**: Detailed analysis with references and citations

## Security

- API key is stored in environment variables
- No API key storage in frontend
- Secure server-side API calls only
