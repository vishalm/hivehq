---
sidebar_position: 4
title: "HIVE Chat Widget"
description: "Data-grounded AI assistant for consumption analysis"
---

# HIVE Chat Widget

HIVE includes an AI-powered chat assistant that answers questions about your consumption data.

## Overview

The Chat Widget is:
- Grounded in your consumption data (not a generic chatbot)
- Zero content (never reads prompts/completions)
- Audit-logged (all queries recorded)
- Compliance-aware (respects data residency and retention)

Ask questions like:
- "What was our spend last week?"
- "Which departments use GPT-4?"
- "Show me anomalies from yesterday"
- "Forecast my March spend"
- "What's our most expensive model?"

The assistant retrieves data from HIVE Node and synthesizes answers.

## Architecture

```
User → Chat Widget → LLM Prompt Generator → HIVE Node API → Data
                              ↓
                        SQL Query Builder
                              ↓
                        Result → Answer
```

The LLM (configurable) generates SQL-like queries, which are executed safely against HIVE Node.

## Configuration

Dashboard → Settings → Chat

**LLM Provider**

Select which LLM to use:

```
Provider: [OpenAI ▼]
  Model: [gpt-3.5-turbo ▼]
  API Key: [sk-... ▼]

Provider: [Anthropic ▼]
  Model: [claude-opus ▼]
  API Key: [sk-ant-... ▼]
```

Or use local:

```
Provider: [Ollama ▼]
  Endpoint: [http://localhost:11434 ▼]
  Model: [mistral ▼]
```

**Prompt Template**

Customize the system prompt (expert mode):

```
You are a data analyst for HIVE, a token economy platform.
Your role is to help users understand their AI consumption.

When users ask questions, you:
1. Generate a SQL query to retrieve data from HIVE Node API
2. Execute the query
3. Format results in a clear, summary format

Available data:
- Events table: timestamp, provider, model, tokens, cost, latency, department
- Costs table: hourly aggregates
- Anomalies table: detected anomalies
- Forecasts table: spend predictions

Guidelines:
- Always cite data sources
- Explain anomalies with reasoning
- Suggest optimizations when relevant
- Never make up data
```

## Usage

### Basic Queries

**Spend Reporting**

```
User: "What was our total spend last week?"