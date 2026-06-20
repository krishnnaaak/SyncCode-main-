/**
 * CodeExecutor Component
 * File: client/src/components/CodeExecutor.js
 * 
 * Execute code and display output
 * Supports: C++, Python, Java, JavaScript
 */

import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../styles/CodeExecutor.css';

const CodeExecutor = ({ code = '', language = 'cpp' }) => {
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stdin, setStdin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [executionTime, setExecutionTime] = useState('');
  const [memory, setMemory] = useState('');

  const handleExecute = async () => {
    if (!code.trim()) {
      toast.error('Please write some code first');
      return;
    }

    try {
      setLoading(true);
      setOutput('');
      setError('');
      setExecutionTime('');
      setMemory('');

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

      const response = await axios.post(
        `${backendUrl}/api/v1/execute/run`,
        {
          code,
          language,
          stdin: stdin || '',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      if (data.success) {
        setOutput(data.output || '(No output)');
        setError(data.error || '');
        setExecutionTime(data.executionTime);
        setMemory(data.memory);

        if (data.status !== 'Accepted') {
          toast.error(`Execution Status: ${data.status}`);
        } else {
          toast.success('Code executed successfully');
        }
      } else {
        setError(data.message || 'Execution failed');
        toast.error(data.message || 'Execution failed');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Execution failed';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOutput = async () => {
    try {
      const textToCopy = output + (error ? '\n\nErrors:\n' + error : '');
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Output copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy output');
    }
  };

  const handleClearOutput = () => {
    setOutput('');
    setError('');
    setExecutionTime('');
    setMemory('');
  };

  return (
    <div className="codeExecutor">
      {/* Controls */}
      <div className="executorControls">
        <button
          className="executeBtn"
          onClick={handleExecute}
          disabled={loading || !code.trim()}
          title="Execute code (Ctrl+Enter)"
        >
          {loading ? (
            <>
              <span className="spinner"></span> Executing...
            </>
          ) : (
            '▶️ Execute'
          )}
        </button>

        <button
          className="inputToggleBtn"
          onClick={() => setShowInput(!showInput)}
          title="Toggle input panel"
        >
          {showInput ? '▼ Input' : '▶ Input'}
        </button>

        {(output || error) && (
          <>
            <button
              className="copyBtn"
              onClick={handleCopyOutput}
              title="Copy output to clipboard"
            >
              📋 Copy
            </button>
            <button
              className="clearBtn"
              onClick={handleClearOutput}
              title="Clear output"
            >
              🗑️ Clear
            </button>
          </>
        )}
      </div>

      {/* Input Panel */}
      {showInput && (
        <div className="inputPanel">
          <label>Standard Input (stdin)</label>
          <textarea
            className="inputTextarea"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Enter input for your code (optional)..."
          />
        </div>
      )}

      {/* Output Panel */}
      {(output || error) && (
        <div className="outputPanel">
          {output && (
            <div className="outputSection">
              <h4>Output</h4>
              <pre className="outputText">{output}</pre>
              {executionTime && (
                <div className="executionStats">
                  ⏱️ {executionTime} | 💾 {memory}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="errorSection">
              <h4>Error / Status</h4>
              <pre className="errorText">{error}</pre>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loadingState">
          <div className="spinner"></div>
          <p>Executing code...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !output && !error && (
        <div className="emptyState">
          <p>💻 Write code and click Execute to see output here</p>
        </div>
      )}
    </div>
  );
};

export default CodeExecutor;
