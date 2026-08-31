import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Fab, Drawer, Typography, IconButton, TextField, Chip, Divider,
  Paper, CircularProgress, Tooltip, Stack
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { assistantApi } from './api';

const STARTER_EXAMPLES = [
  'Lowest latency 1Gb Singapore to London',
  'PoPs in London',
  '10Gb Frankfurt to New York'
];

// Assistant "Ask" chat - V1 scope: route finding + promo pricing only.
// A persistent drawer/FAB (not a new page) available from any tab, wired
// into the existing preComputedRoute flow so "Open in Route Finder" reuses
// the same deep-link behaviour as a homepage latency matrix click.
export default function AssistantChat({ onOpenRouteFinder }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const resetConversation = () => {
    setMessages([]);
    setConversation(null);
    setInput('');
  };

  const sendMessage = async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const response = await assistantApi.query(trimmed, conversation);
      setConversation(response.conversation || null);
      setMessages(prev => [...prev, { role: 'assistant', response }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        response: { status: 'error', reply: 'Something went wrong: ' + (err.response?.data?.error || err.message) }
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRouteFinder = (action) => {
    if (!onOpenRouteFinder) return;
    const lastAnswer = [...messages].reverse().find(m => m.role === 'assistant' && m.response?.status === 'answered' && m.response?.result?.route);
    const result = lastAnswer?.response?.result;
    onOpenRouteFinder({
      source: action.source,
      destination: action.destination,
      totalLatency: result ? result.totalLatency : undefined,
      route: result ? result.route : [],
      tier: action.bandwidth >= 1000 ? `${action.bandwidth / 1000}Gb` : `${action.bandwidth}Mb`
    });
    setOpen(false);
  };

  return (
    <>
      <Tooltip title="Ask about routes &amp; promo pricing">
        <Fab
          color="primary"
          onClick={() => setOpen(true)}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: (theme) => theme.zIndex.drawer + 2 }}
          aria-label="open assistant chat"
        >
          <ChatIcon />
        </Fab>
      </Tooltip>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: { xs: '100vw', sm: 420 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
            <SmartToyIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Ask</Typography>
            <Tooltip title="New conversation">
              <IconButton onClick={resetConversation} size="small" sx={{ mr: 0.5 }}>
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setOpen(false)} size="small" aria-label="close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box ref={listRef} sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
            {messages.length === 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Ask about the lowest-latency route between two locations (with promo pricing folded in automatically), or list the PoPs in a city.
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                  {STARTER_EXAMPLES.map(example => (
                    <Chip key={example} label={example} size="small" onClick={() => sendMessage(example)} sx={{ mb: 1 }} />
                  ))}
                </Stack>
              </Box>
            )}

            {messages.map((m, idx) => (
              <ChatBubble key={idx} message={m} onChipClick={sendMessage} onOpenRouteFinder={handleOpenRouteFinder} />
            ))}

            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">Thinking…</Typography>
              </Box>
            )}
          </Box>

          <Divider />
          <Box sx={{ p: 1.5, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. lowest latency 1Gb Singapore to London"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              disabled={loading}
            />
            <IconButton color="primary" onClick={() => sendMessage(input)} disabled={loading || !input.trim()} aria-label="send">
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

function ChatBubble({ message, onChipClick, onOpenRouteFinder }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Paper elevation={0} sx={{ px: 1.5, py: 1, maxWidth: '85%', bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2 }}>
          <Typography variant="body2">{message.text}</Typography>
        </Paper>
      </Box>
    );
  }

  const response = message.response || {};

  return (
    <Box sx={{ display: 'flex', mb: 1.5 }}>
      <SmartToyIcon fontSize="small" color="action" sx={{ mr: 1, mt: 0.5, flexShrink: 0 }} />
      <Paper variant="outlined" sx={{ px: 1.5, py: 1, maxWidth: '90%', borderRadius: 2 }}>
        <Typography variant="body2">{response.reply}</Typography>

        {Array.isArray(response.notes) && response.notes.length > 0 && (
          <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5 }}>
            {response.notes.map((note, i) => (
              <Typography key={i} component="li" variant="caption" color="text.secondary">{note}</Typography>
            ))}
          </Box>
        )}

        {Array.isArray(response.options) && response.options.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {response.options.map(opt => (
              <Chip key={opt.value} label={opt.label} size="small" color="primary" variant="outlined" onClick={() => onChipClick(opt.value)} sx={{ mb: 1 }} />
            ))}
          </Stack>
        )}

        {Array.isArray(response.examples) && response.examples.length > 0 && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {response.examples.map(example => (
              <Chip key={example} label={example} size="small" onClick={() => onChipClick(example)} sx={{ mb: 1 }} />
            ))}
          </Stack>
        )}

        {response.status === 'answered' && Array.isArray(response.actions) && response.actions.some(a => a.type === 'open_route_finder') && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Chip
              icon={<OpenInNewIcon />}
              label="Open in Route Finder"
              size="small"
              color="secondary"
              onClick={() => onOpenRouteFinder(response.actions.find(a => a.type === 'open_route_finder'))}
            />
            {response.result?.diversePath && (
              <Chip label="What about protected?" size="small" variant="outlined" onClick={() => onChipClick('what about protected?')} />
            )}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
