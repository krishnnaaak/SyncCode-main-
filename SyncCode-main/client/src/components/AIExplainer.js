/**
 * AIExplainer Component
 * File: client/src/components/AIExplainer.js
 * 
 * Shows real-time code explanation:
 * - What the code does
 * - Time/Space complexity
 * - Potential bugs
 * - Improvement suggestions
 */

import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import '../styles/AIExplainer.css';

const AIExplainer = ({ code = '', language = 'cpp' }) => {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleExplain = async () => {
    if (!code.trim()) {
      toast.error('Write some code first');
      return;
    }

    if (code.length < 20) {
      toast.error('Code too short (min 20 chars)');
      return;
    }

    try {
      setLoading(true);
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

      const response = await axios.post(
        `${backendUrl}/api/v1/ai/explain`,
        {
          code,
          language,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;

      if (data.success) {
        setExplanation(data);
        setIsOpen(true);
        toast.success('Code analyzed!');
      } else {
        toast.error(data.message || 'Analysis failed');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Analysis failed';
      toast.error(errorMsg);
      console.error('AIExplainer error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Explain Button */}
      <button
        className="explainBtn"
        onClick={handleExplain}
        disabled={loading || !code.trim()}
        title="Analyze code and get explanation"
      >
        {loading ? (
          <>
            <span className="spinner"></span> Analyzing...
          </>
        ) : (
          '🤖 Explain Code'
        )}
      </button>

      {/* Explanation Modal/Drawer */}
      {isOpen && (
        <div className="explainerOverlay" onClick={() => setIsOpen(false)}>
          <div className="explainerPanel" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="explainerHeader">
              <h3>🤖 Code Analysis</h3>
              <button
                className="closeBtn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            {explanation && (
              <div className="explainerContent">
                {/* Overview */}
                {explanation.explanation && (
                  <section className="explainerSection">
                    <h4>📝 What It Does</h4>
                    <p className="sectionText">{explanation.explanation}</p>
                  </section>
                )}

                {/* Complexity */}
                {explanation.complexity && (
                  <section className="explainerSection">
                    <h4>⏱️ Complexity Analysis</h4>
                    <div className="complexityBox">
                      <div className="complexityItem">
                        <span className="label">Time:</span>
                        <span className="value">{explanation.complexity.time}</span>
                      </div>
                      <div className="complexityItem">
                        <span className="label">Space:</span>
                        <span className="value">{explanation.complexity.space}</span>
                      </div>
                    </div>
                  </section>
                )}

                {/* Issues */}
                {explanation.issues && explanation.issues.length > 0 && (
                  <section className="explainerSection">
                    <h4>🐛 Potential Issues</h4>
                    <ul className="itemsList">
                      {explanation.issues.map((issue, idx) => (
                        <li key={idx} className="issueItem">
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Improvements */}
                {explanation.improvements && explanation.improvements.length > 0 && (
                  <section className="explainerSection">
                    <h4>💡 Improvements</h4>
                    <ul className="itemsList">
                      {explanation.improvements.map((improvement, idx) => (
                        <li key={idx} className="improvementItem">
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* No content fallback */}
                {!explanation.explanation && 
                 (!explanation.issues || explanation.issues.length === 0) &&
                 (!explanation.improvements || explanation.improvements.length === 0) && (
                  <div className="noContent">
                    <p>Analysis complete, but no detailed breakdown available.</p>
                    <p className="small">Try with a longer or more complex code snippet.</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="explainerFooter">
              <button
                className="closeFooterBtn"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIExplainer;