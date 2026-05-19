import { useState, useEffect } from "react";
import ImageUpload from "./ImageUpload/ImageUpload";

export default function Dashboard({ user, token, API_URL, onUserUpdate, onLogout, initialScan, clearInitialScan }) {
  const [activeTab, setActiveTab] = useState("scan"); // "scan" | "history"
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedScan, setSelectedScan] = useState(null); // Detailed modal

  // Health Profile Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [bloodGroup, setBloodGroup] = useState(user?.blood_group || "");
  const [allergies, setAllergies] = useState(user?.allergies || "");
  const [diabetic, setDiabetic] = useState(user?.diabetic || "");
  const [otherConditions, setOtherConditions] = useState(user?.other_conditions || "");
  const [updateLoading, setUpdateLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Body scroll lock hook when popups are active
  useEffect(() => {
    if (isEditing || selectedScan) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isEditing, selectedScan]);

  // Sync state variables with user prop on change
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setGender(user.gender || "");
      setBloodGroup(user.blood_group || "");
      setAllergies(user.allergies || "");
      setDiabetic(user.diabetic || "");
      setOtherConditions(user.other_conditions || "");
    }
  }, [user]);

  // Fetch scan history from backend linked to user's MongoDB records
  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/image-scan/my-scans`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch scan history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  useEffect(() => {
    if (initialScan) {
      setSelectedScan(initialScan);
      if (clearInitialScan) {
        clearInitialScan();
      }
    }
  }, [initialScan, clearInitialScan]);

  const handleScanSuccess = (scannedItem) => {
    fetchHistory(); // Refresh history list
    if (scannedItem) {
      setSelectedScan(scannedItem); // Immediately display scan details in modal popup
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return { text: "#15803d", ring: "#16a34a", bg: "#f0fdf4", label: "Healthy" };
    if (score >= 50) return { text: "#a16207", ring: "#ca8a04", bg: "#fefce8", label: "Moderate" };
    return { text: "#b91c1c", ring: "#dc2626", bg: "#fef2f2", label: "Needs Caution" };
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!token) return;
    setUpdateLoading(true);
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_URL}/api/auth/me/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          gender,
          blood_group: bloodGroup,
          allergies,
          diabetic,
          other_conditions: otherConditions
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        if (onUserUpdate) {
          onUserUpdate(updated); // Sync global App.jsx state!
        }
        setSuccessMsg("Health profile updated successfully!");
        setTimeout(() => {
          setSuccessMsg("");
          setIsEditing(false);
        }, 1500);
      } else {
        console.error("Profile update failed");
      }
    } catch (err) {
      console.error("Error updating profile:", err);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "⚠️ WARNING: Are you absolutely sure you want to delete your account?\n\nThis will permanently delete all your scanned food profiles, historical records, and personal health metrics. This action CANNOT be undone."
    );
    if (!confirmDelete) return;

    setUpdateLoading(true);
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_URL}/api/auth/me/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setSuccessMsg("Account deleted. Good bye! 👋");
        setTimeout(() => {
          setIsEditing(false);
          if (onLogout) {
            onLogout();
          }
        }, 2000);
      } else {
        const errData = await res.json().catch(() => ({ detail: "Deletion failed" }));
        alert(`Error deleting account: ${errData.detail || "Server error"}`);
      }
    } catch (err) {
      console.error("Account deletion error:", err);
      alert("Failed to delete account. Please try again later.");
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Dashboard Top Header */}
      <div className="dashboard-header animate-fade-in">
        <div className="user-profile-card glass-card">
          <img src={user.picture || "https://api.dicebear.com/7.x/adventurer/svg"} alt="avatar" className="profile-large-avatar" />
          <div className="profile-large-details">
            <div className="profile-name-header-row">
              <h2>Welcome, {user.name}!</h2>
              {!isEditing && (
                <button className="btn-edit-profile-trigger" onClick={() => setIsEditing(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 5 }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Profile
                </button>
              )}
            </div>
            <p>{user.email}</p>
            <div className="profile-stat-pills">
              <span className="stat-pill bg-scans-count">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Scanned: {history.length}
              </span>

              {user.gender && (
                <span className="stat-pill bg-health-info">
                  Gender: {user.gender}
                </span>
              )}
              {user.blood_group && (
                <span className="stat-pill bg-health-info">
                  Blood Group: {user.blood_group}
                </span>
              )}
              {user.diabetic && (
                <span className="stat-pill bg-health-info">
                  Diabetic: {user.diabetic}
                </span>
              )}
              {user.allergies && (
                <span className="stat-pill bg-health-warn" title={`Allergies: ${user.allergies}`}>
                  Allergies: {user.allergies}
                </span>
              )}
              {user.other_conditions && (
                <span className="stat-pill bg-health-info" title={`Other conditions: ${user.other_conditions}`}>
                  Medical: {user.other_conditions}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Tabs Selector */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === "scan" ? "active" : ""}`}
          onClick={() => setActiveTab("scan")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Scan Food Label
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("history");
            fetchHistory();
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Scanned Profiles ({history.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tab-content-area">
        {activeTab === "scan" ? (
          <div className="glass-card panel-scan animate-fade-in">
            <ImageUpload token={token} API_URL={API_URL} onScanSuccess={handleScanSuccess} />
          </div>
        ) : (
          <div className="history-grid-wrapper animate-fade-in">
            {loading ? (
              <div className="loading-spinner-box">
                <div className="loading-spinner"></div>
                <p>Retrieving your scan profile history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="empty-history-box glass-card">
                <div className="empty-history-icon-wrapper" style={{ marginBottom: 16, color: "var(--color-text-tertiary)" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z" />
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2" />
                  </svg>
                </div>
                <h3>No scanned items yet</h3>
                <p>Your scan history is empty. Go to the "Scan Food Label" tab and upload a label photo to generate your first health profile card!</p>
                <button className="btn-primary" onClick={() => setActiveTab("scan")}>Start Scanning</button>
              </div>
            ) : (
              <div className="history-grid">
                {history.map((scan) => {
                  const scoreConfig = getScoreColor(scan.health_score.score);
                  return (
                    <div
                      key={scan._id}
                      className="history-card glass-card hover-lift"
                      onClick={() => setSelectedScan(scan)}
                    >
                      <div className="history-card-img-box">
                        <img
                          src={scan.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"}
                          alt="product label"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"; // Fallback if local image not found
                          }}
                        />
                        <div className="history-card-score-badge" style={{ background: scoreConfig.bg, color: scoreConfig.text, border: `1px solid ${scoreConfig.ring}33` }}>
                          {scan.health_score.score}
                        </div>
                      </div>
                      <div className="history-card-body">
                        <div className="history-card-brand">{scan.product?.brand || "Packaged Food"}</div>
                        <h4 className="history-card-title">{scan.product?.name || "Unknown Product"}</h4>
                        <div className="history-card-date">
                          📅 {new Date(scan.scanned_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="history-card-rating" style={{ color: scoreConfig.text, fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                          {scoreConfig.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Modal Drawer */}
      {selectedScan && (
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedScan(null)}>
          <div className="modal-drawer animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {selectedScan.image_url === "barcode_scan" ? (
                  <div style={{
                    width: 50,
                    height: 50,
                    borderRadius: 8,
                    background: "var(--color-primary-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--color-primary)",
                    flexShrink: 0
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-dark)" strokeWidth="2.5">
                      <path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2z" />
                      <path d="M7 7h2v10H7zm4 0h1v10h-1zm3 0h3v10h-3zm5 0h1v10h-1z" />
                    </svg>
                  </div>
                ) : (
                  <img
                    src={selectedScan.image_url}
                    alt="thumbnail"
                    className="modal-thumbnail-img"
                    onError={(e) => {
                      e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c";
                    }}
                  />
                )}
                <div>
                  <h3 className="modal-title">{selectedScan.product?.name || "Unknown Product"}</h3>
                  <p className="modal-subtitle">{selectedScan.product?.brand || "Scanned Label"}</p>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedScan(null)}>&times;</button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {/* Health Score Block */}
              <div className="modal-section-score" style={{
                background: getScoreColor(selectedScan.health_score.score).bg,
                borderColor: getScoreColor(selectedScan.health_score.score).ring + "22"
              }}>
                <div className="modal-score-ring-box">
                  <div className="modal-score-value" style={{ color: getScoreColor(selectedScan.health_score.score).text }}>
                    {selectedScan.health_score.score}
                  </div>
                  <div className="modal-score-max">/100</div>
                </div>
                <div>
                  <div className="modal-score-label" style={{ color: getScoreColor(selectedScan.health_score.score).text }}>
                    Health Rating: {selectedScan.health_score.label}
                  </div>
                  <div style={{ fontSize: 13, color: getScoreColor(selectedScan.health_score.score).text, opacity: 0.8 }}>
                    Computed based on NutriScore & NOVA standards.
                  </div>
                </div>
              </div>

              {/* WHY THIS SCORE (Reasons) */}
              {selectedScan.health_score.reasons?.length > 0 && (
                <div className="modal-info-block">
                  <h4 className="info-block-title">Key Health Metrics Detected</h4>
                  <div className="reason-pills-box">
                    {selectedScan.health_score.reasons.map((r, i) => {
                      const isBad = r.toLowerCase().includes("high") || r.toLowerCase().includes("ultra");
                      const isGood = r.toLowerCase().includes("low") || r.toLowerCase().includes("good") || r.toLowerCase().includes("minimal");
                      const c = isBad ? "#dc2626" : isGood ? "#16a34a" : "#ca8a04";
                      const bg = isBad ? "#fef2f2" : isGood ? "#f0fdf4" : "#fefce8";
                      return (
                        <span key={i} className="reason-pill" style={{ color: c, background: bg, border: `1px solid ${c}22` }}>
                          {r}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HEALTHY ALTERNATIVES RECOMMENDATIONS (CRITICAL VOICE REQUIREMENT) */}
              <div className="modal-recommendation-block">
                <h4 className="recommendation-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--color-primary)" }}>
                    {selectedScan.health_score.score >= 70 ? (
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    ) : (
                      <>
                        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                      </>
                    )}
                  </svg>
                  {selectedScan.health_score.score >= 70 ? "More Healthy Choices Recommended" : "Healthier Alternatives Recommended"}
                </h4>
                {selectedScan.healthy_alternatives && selectedScan.healthy_alternatives.length > 0 ? (
                  <div className="alternatives-list">
                    {selectedScan.healthy_alternatives.map((alt, i) => (
                      <div key={i} className="alternative-card glass-card">
                        <div className="alternative-card-header">
                          <span className="alt-sparkle-icon" style={{ display: "inline-flex", alignItems: "center", color: "var(--color-primary)", marginRight: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </span>
                          <span className="alt-name">{alt.name}</span>
                        </div>
                        <p className="alt-reason">{alt.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-recommendations-card">
                    <span className="empty-recommendations-icon" style={{ color: "var(--color-primary)", marginBottom: 8, display: "inline-flex" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {selectedScan.health_score.score >= 70 
                        ? "This product complies with a high healthy nutrition index. Enjoy!"
                        : "No alternative recommendations available."
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Nutrition Details Grid */}
              <div className="modal-nutrition-table">
                <h4 className="nutrition-table-title">Nutrition Facts (per 100g)</h4>
                <div className="nutrition-grid-rows">
                  <div className="nutri-row"><span>Energy</span><strong>{selectedScan.product?.nutrition?.energy_kcal ?? "—"} kcal</strong></div>
                  <div className="nutri-row"><span>Total Fat</span><strong>{selectedScan.product?.nutrition?.fat ?? "—"} g</strong></div>
                  <div className="nutri-row"><span>Saturated Fat</span><strong>{selectedScan.product?.nutrition?.saturated_fat ?? "—"} g</strong></div>
                  <div className="nutri-row"><span>Sugars</span><strong>{selectedScan.product?.nutrition?.sugars ?? "—"} g</strong></div>
                  <div className="nutri-row"><span>Sodium</span><strong>{selectedScan.product?.nutrition?.sodium != null ? (selectedScan.product.nutrition.sodium * 1000).toFixed(0) : "—"} mg</strong></div>
                  <div className="nutri-row"><span>Dietary Fiber</span><strong>{selectedScan.product?.nutrition?.fiber ?? "—"} g</strong></div>
                  <div className="nutri-row"><span>Proteins</span><strong>{selectedScan.product?.nutrition?.proteins ?? "—"} g</strong></div>
                </div>
              </div>

              {/* Additives Detected */}
              {selectedScan.additives_detected?.length > 0 && (
                <div className="modal-danger-box">
                  <h4 style={{ color: '#b91c1c', margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Additives Detected
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedScan.additives_detected.map((a, i) => (
                      <span key={i} className="additive-badge">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ingredients List */}
              {selectedScan.product?.ingredients && (
                <div className="modal-ingredients-box">
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Full Ingredients</h4>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{selectedScan.product.ingredients}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sliding Health Profile Edit Modal Overlay */}
      {isEditing && (
        <div className="profile-modal-overlay animate-fade-in" onClick={() => setIsEditing(false)}>
          <div className="profile-modal-card glass-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={() => setIsEditing(false)} aria-label="Close Profile Editor">
              &times;
            </button>

            <div className="drawer-header">
              <h3>🧬 Personal Health & Identity Profile</h3>
              <p>These metrics help customize FSSAI / BIS alternative recommendations to your body conditions.</p>
            </div>

            <form onSubmit={handleProfileUpdate} className="drawer-form-grid">
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Enter full name"
                />
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="form-group">
                <label>Blood Group</label>
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              <div className="form-group">
                <label>Diabetic Status</label>
                <select value={diabetic} onChange={(e) => setDiabetic(e.target.value)}>
                  <option value="">Select Diabetic Status</option>
                  <option value="Non-diabetic">Non-diabetic</option>
                  <option value="Pre-diabetic">Pre-diabetic</option>
                  <option value="Type-1 Diabetic">Type-1 Diabetic</option>
                  <option value="Type-2 Diabetic">Type-2 Diabetic</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Allergies (comma-separated)</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Peanuts, Gluten, Dairy, Soy, none"
                />
              </div>

              <div className="form-group full-width">
                <label>Other Health / Medical Conditions</label>
                <input
                  type="text"
                  value={otherConditions}
                  onChange={(e) => setOtherConditions(e.target.value)}
                  placeholder="e.g. Hypertension, Lactose intolerance, none"
                />
              </div>

              {successMsg && (
                <div className="form-success-banner full-width">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 6 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {successMsg}
                </div>
              )}

              <div className="form-actions-row full-width" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn-save-profile" disabled={updateLoading}>
                    {updateLoading ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" className="btn-cancel-profile" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-delete-account"
                  onClick={handleDeleteAccount}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#b91c1c'}
                  onMouseLeave={(e) => e.target.style.background = '#dc2626'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
