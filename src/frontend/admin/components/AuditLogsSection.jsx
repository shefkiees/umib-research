function AuditLogsSection() { 

  const logs = [ 

    { 

      action: "Login", 

      user: "a.hoxha@umib.edu", 

      category: "Auth", 

      time: "10:42", 

    }, 

    { 

      action: "Aprovoi punim #2241", 

      user: "m.krasniqi@umib.edu", 

      category: "Submissions", 

      time: "10:31", 

    }, 

    { 

      action: "Ndryshoi rolin e përdoruesit", 

      user: "a.rexhepi@umib.edu", 

      category: "Users", 

      time: "10:18", 

    }, 

    { 

      action: "Edito metadata #1182", 

      user: "e.berisha@umib.edu", 

      category: "Metadata", 

      time: "09:55", 

    }, 

    { 

      action: "Logout", 

      user: "l.gashi@umib.edu", 

      category: "Auth", 

      time: "09:40", 

    }, 

  ]; 

 

  return ( 

    <div className="admin-grid-2"> 

      <section className="admin-section-card"> 

        <div className="admin-section-head"> 

          <div> 

            <h2>Audit Logs</h2> 

            <p>Aktivitetet e fundit në sistem</p> 

          </div> 

 

          <div className="admin-section-actions"> 

            <button className="admin-secondary-btn">Filtro</button> 

          </div> 

        </div> 

 

        <div className="admin-log-list"> 

          {logs.map((log, index) => ( 

            <div className="admin-log-row" key={index}> 

              <div> 

                <strong>{log.action}</strong> 

                <p>{log.user}</p> 

              </div> 

 

              <div className="admin-log-meta"> 

                <span className="admin-log-chip">{log.category}</span> 

                <p>{log.time}</p> 

              </div> 

            </div> 

          ))} 

        </div> 

      </section> 

 

      <section className="admin-section-card"> 

        <div className="admin-section-head"> 

          <div> 

            <h2>Alerts & Njoftime</h2> 

            <p>Aktiviteti i fundit i sigurisë</p> 

          </div> 

        </div> 

 

        <div className="admin-alert-list"> 

          <div className="admin-alert-item danger"> 

            <h4>3 tentativa të pasuksesshme login</h4> 

            <p>para 5 min</p> 

          </div> 

 

          <div className="admin-alert-item warning"> 

            <h4>1 përdorues është çaktivizuar për arsye sigurie</h4> 

            <p>para 1 ore</p> 

          </div> 

 

          <div className="admin-alert-item warning"> 

            <h4>Integrimi me Crossref pati vonesë</h4> 

            <p>para 3 ore</p> 

          </div> 

 

          <div className="admin-alert-item success"> 

            <h4>Backup-i i fundit u realizua me sukses</h4> 

            <p>para 24 ore</p> 

          </div> 

        </div> 

      </section> 

    </div> 

  ); 

} 

 

export default AuditLogsSection;