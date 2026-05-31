import React from "react"; 

 

function UsersSection() { 

  const users = [ 

    { 

      name: "Prof. Arben Hoxha", 

      email: "a.hoxha@umib.edu", 

      role: "Profesor", 

      status: "Aktiv", 

      faculty: "FSHN", 

    }, 

    { 

      name: "Dr. Mira Krasniqi", 

      email: "m.krasniqi@umib.edu", 

      role: "Komisioni", 

      status: "Aktiv", 

      faculty: "FE", 

    }, 

    { 

      name: "Prof. Bahtir Begu", 

      email: "b.begu@umib.edu", 

      role: "Prorektor", 

      status: "Aktiv", 

      faculty: "Rektorati", 

    }, 

    { 

      name: "Dr. Lulzim Gashi", 

      email: "l.gashi@umib.net", 

      role: "Profesor", 

      status: "Çaktivizuar", 

      faculty: "FIM", 

    }, 

    { 

      name: "Ana Rexhepi", 

      email: "a.rexhepi@umib.edu", 

      role: "Admin", 

      status: "Aktiv", 

      faculty: "IT", 

    }, 

    { 

      name: "Dr. Burim Maliqi", 

      email: "b.maliqi@umib.edu", 

      role: "Profesor", 

      status: "Aktiv", 

      faculty: "FSHN", 

    }, 

  ]; 

 

  return ( 

    <section className="admin-users-card"> 

      <div className="admin-users-head"> 

        <div> 

          <h2>Menaxhimi i Përdoruesve</h2> 

          <p>UC-14 • Aktivizo, çaktivizo dhe ndrysho rolet</p> 

        </div> 

 

        <span className="admin-users-count">142 përdorues</span> 

      </div> 

 

      <div className="admin-users-table-wrap"> 

        <table className="admin-users-table"> 

          <thead> 

            <tr> 

              <th>Emri</th> 

              <th>Email</th> 

              <th>Roli</th> 

              <th>Statusi</th> 

              <th>Fakulteti</th> 

              <th>Veprimet</th> 

            </tr> 

          </thead> 

 

          <tbody> 

            {users.map((user, index) => ( 

              <tr key={index}> 

                <td className="admin-user-name">{user.name}</td> 

                <td className="admin-user-email">{user.email}</td> 

                <td> 

                  <span className="admin-user-role-chip">{user.role}</span> 

                </td> 

                <td> 

                  <span 

                    className={`admin-user-status-chip ${ 

                      user.status === "Aktiv" ? "active" : "inactive" 

                    }`} 

                  > 

                    <span className="admin-user-status-dot" /> 

                    {user.status} 

                  </span> 

                </td> 

                <td className="admin-user-faculty">{user.faculty}</td> 

                <td> 

                  <button type="button" className="admin-user-more-btn"> 

                    ... 

                  </button> 

                </td> 

              </tr> 

            ))} 

          </tbody> 

        </table> 

      </div> 

    </section> 

  ); 

} 

 

export default UsersSection; 
