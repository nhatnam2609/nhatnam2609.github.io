import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [pictures, setPictures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState({});
  const [showThankYou, setShowThankYou] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [lastVotedPicture, setLastVotedPicture] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [stats, setStats] = useState(null);

  // Function to get the correct image URL based on environment
  const getImageUrl = (filename) => {
    // In production, images are served by the Express server at /images/
    // In development, we use the proxy which forwards to the backend
    return `/images/${filename}`;
  };

  // Get or create session ID
  const initializeSession = async () => {
    let storedSessionId = localStorage.getItem('harleyVotingSession');
    
    if (!storedSessionId) {
      try {
        const response = await fetch('/api/session');
        const data = await response.json();
        storedSessionId = data.sessionId;
        localStorage.setItem('harleyVotingSession', storedSessionId);
      } catch (error) {
        console.error('Error creating session:', error);
        return;
      }
    }
    
    setSessionId(storedSessionId);
  };

  // Fetch pictures from backend
  const fetchPictures = async () => {
    try {
      const response = await fetch('/api/pictures');
      const data = await response.json();
      setPictures(data);
    } catch (error) {
      console.error('Error fetching pictures:', error);
    }
  };

  // Fetch stats from backend
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      await initializeSession();
      await fetchPictures();
      await fetchStats();
      setLoading(false);
    };

    initializeApp();

    // Auto-refresh every 30 seconds to get latest vote counts
    const interval = setInterval(() => {
      fetchPictures();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleVote = async (pictureId) => {
    if (!sessionId) {
      alert('Session not initialized. Please refresh the page.');
      return;
    }

    const picture = pictures.find(p => p.id === pictureId);
    if (!picture) return;

    setVoting(prev => ({ ...prev, [pictureId]: true }));
    
    try {
      const response = await fetch(`/api/vote/${pictureId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
      });

      const result = await response.json();
      
      if (response.ok) {
        // Set the voted picture for thank you message
        setLastVotedPicture(picture);
        
        // Refresh data after successful vote
        await fetchPictures();
        await fetchStats();
        
        setTimeout(() => {
          setVoting(prev => ({ ...prev, [pictureId]: false }));
          // Show thank you effect
          setShowThankYou(true);
          
          // After 2 seconds, show leaderboard
          setTimeout(() => {
            setShowThankYou(false);
            setShowLeaderboard(true);
            
            // Hide leaderboard after 4 seconds
            setTimeout(() => {
              setShowLeaderboard(false);
            }, 4000);
          }, 2000);
        }, 1000);
      } else {
        alert(result.error || 'Failed to record vote');
        setVoting(prev => ({ ...prev, [pictureId]: false }));
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Error recording vote. Please try again.');
      setVoting(prev => ({ ...prev, [pictureId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Harley's pictures...</p>
      </div>
    );
  }

  const topThree = stats?.topThree || [];
  const totalVotes = stats?.totalVotes || 0;

  return (
    <div className="App">
      <header className="App-header">
        <h1>🐕 What's the Best Picture of Harley? 🐾</h1>
        <p>Vote for your favorite picture of Harley! You can vote once per day per picture.</p>
      </header>

      <main className="pictures-grid">
        {pictures.length === 0 ? (
          <div className="no-pictures">
            <h3>📸 No pictures found!</h3>
            <p>Add some pictures of Harley to the 'images' folder</p>
          </div>
        ) : (
          pictures.map((picture, index) => (
            <div key={picture.id} className="picture-card">
              <div className="picture-container">
                <img 
                  src={getImageUrl(picture.filename)} 
                  alt={`Harley ${index + 1}`}
                  loading="lazy"
                  onError={(e) => {
                    console.error('Image failed to load:', picture.filename);
                    e.target.src = `https://via.placeholder.com/300x300?text=Image+Not+Found`;
                  }}
                />
                <div className="picture-overlay">
                  <div className="vote-info">
                    <span className="vote-count">❤️ {picture.votes}</span>
                  </div>
                </div>
              </div>
              <div className="picture-actions">
                <h3 className="picture-title">Picture #{index + 1}</h3>
                <button 
                  className={`vote-button ${voting[picture.id] ? 'voting' : ''}`}
                  onClick={() => handleVote(picture.id)}
                  disabled={voting[picture.id]}
                >
                  {voting[picture.id] ? '⏳ Voting...' : '🐾 Vote for this Harley!'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      {totalVotes > 0 && (
        <div className="stats-section">
          <h2>🏆 Top 3 Most Loved Pictures of Harley</h2>
          <div className="stats-summary">
            <p><strong>Total Votes:</strong> {totalVotes}</p>
            <p><strong>Total Pictures:</strong> {pictures.length}</p>
            {stats?.mostPopular && (
              <p><strong>Current Leader:</strong> Picture #{pictures.findIndex(p => p.filename === stats.mostPopular.filename) + 1} ({stats.mostPopular.votes} votes)</p>
            )}
          </div>
          <div className="top-three-grid">
            {topThree.map((pic, index) => {
              const pictureIndex = pictures.findIndex(p => p.filename === pic.filename);
              const medals = ['🥇', '🥈', '🥉'];
              const percentage = totalVotes > 0 ? (pic.votes / totalVotes * 100).toFixed(1) : 0;
              return (
                <div key={pic.filename} className="top-three-item">
                  <div className="medal">{medals[index]}</div>
                  <div className="top-three-image">
                    <img 
                      src={getImageUrl(pic.filename)} 
                      alt={`Harley ${index + 1}`}
                      onError={(e) => {
                        console.error('Image failed to load:', pic.filename);
                        e.target.src = `https://via.placeholder.com/150x150?text=Image+Not+Found`;
                      }}
                    />
                  </div>
                  <div className="top-three-info">
                    <h3>Picture #{pictureIndex + 1}</h3>
                    <p>{pic.votes} votes ({percentage}%)</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Thank You Popup */}
      {showThankYou && lastVotedPicture && (
        <div className="popup-overlay">
          <div className="thank-you-popup">
            <div className="thank-you-content">
              <div className="celebration">🎉</div>
              <h2>Thank You for Voting!</h2>
              <p>You voted for Picture #{pictures.findIndex(p => p.filename === lastVotedPicture.filename) + 1}</p>
              <div className="voted-image">
                <img 
                  src={getImageUrl(lastVotedPicture.filename)} 
                  alt="Voted Harley"
                />
              </div>
              <p className="hearts">❤️ ❤️ ❤️</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Popup */}
      {showLeaderboard && topThree.length > 0 && (
        <div className="popup-overlay">
          <div className="leaderboard-popup">
            <div className="leaderboard-content">
              <h2>🏆 Current Leaderboard 🏆</h2>
              <div className="leaderboard-list">
                {topThree.map((pic, index) => {
                  const pictureIndex = pictures.findIndex(p => p.filename === pic.filename);
                  const medals = ['🥇', '🥈', '🥉'];
                  const percentage = totalVotes > 0 ? (pic.votes / totalVotes * 100).toFixed(1) : 0;
                  return (
                    <div key={pic.filename} className={`leaderboard-item rank-${index + 1}`}>
                      <div className="rank-medal">{medals[index]}</div>
                      <div className="rank-image">
                        <img 
                          src={getImageUrl(pic.filename)} 
                          alt={`Harley ${pictureIndex + 1}`}
                        />
                      </div>
                      <div className="rank-info">
                        <h3>Picture #{pictureIndex + 1}</h3>
                        <p>{pic.votes} votes ({percentage}%)</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="leaderboard-footer">Keep voting to change the rankings! 🐾</p>
            </div>
          </div>
        </div>
      )}

      <footer className="App-footer">
        <p>🗳️ Help choose the best picture of Harley! Each person can vote once per day per picture.</p>
      </footer>
    </div>
  );
}

export default App;