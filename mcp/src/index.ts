#!/usr/bin/env node
// stdio entry. stdout carries the protocol, so this file writes nothing else to it.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient, DEFAULT_ORIGIN } from './client.ts';
import { createServer } from './tools.ts';

await createServer(createClient(process.env.SECONDHAND_API_ORIGIN || DEFAULT_ORIGIN)).connect(new StdioServerTransport());
