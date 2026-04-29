import React, { useEffect, useState } from "react";
import "../styles/ConferenceManager.css";

function ConferenceManager() {
const [conferences,setConferences]=useState([]);

const [form,setForm]=useState({
title:"",
acronym:"",
field:"",
location:"",
submission_deadline:"",
conference_date:"",
website:""
});


const fetchConferences=async()=>{
const res=await fetch("http://localhost:5000/api/conferences");
const data=await res.json();
setConferences(data);
};

useEffect(()=>{
fetchConferences();
},[]);


const handleChange=(e)=>{
setForm({
...form,
[e.target.name]:e.target.value
});
};


const handleSubmit=async(e)=>{
e.preventDefault();

await fetch("http://localhost:5000/api/conferences",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify(form)
});

setForm({
title:"",
acronym:"",
field:"",
location:"",
submission_deadline:"",
conference_date:"",
website:""
});

fetchConferences();
};


const deleteConference=async(id)=>{
await fetch(
`http://localhost:5000/api/conferences/${id}`,
{
method:"DELETE"
}
);

fetchConferences();
};


const getDeadlineStatus=(deadline)=>{
const today=new Date();
const deadlineDate=new Date(deadline);

const difference=Math.ceil(
(deadlineDate-today)/(1000*60*60*24)
);

if(difference<0) return "Mbyllur";
if(difference<=7) return "Mbyllet së shpejti";

return "Hapur";
};



return(
<div className="conference-page">

<section className="conference-panel">

<div className="conference-header">
<div>
<h2>Shto dhe Menaxho Konferenca</h2>

<p>
Regjistro konferenca, afate aplikimi
dhe menaxho pjesëmarrjet shkencore.
</p>

</div>
</div>


<form
onSubmit={handleSubmit}
className="conference-form"
>

<div className="form-group">
<label>Titulli i Konferencës</label>

<input
name="title"
type="text"
placeholder="Shkruaj titullin e konferencës"
value={form.title}
onChange={handleChange}
required
/>
</div>



<div className="form-group">
<label>Akronimi</label>

<input
name="acronym"
type="text"
placeholder="p.sh ICIS"
value={form.acronym}
onChange={handleChange}
/>
</div>



<div className="form-group">
<label>Fusha Kërkimore</label>

<input
name="field"
type="text"
placeholder="Shkenca Kompjuterike"
value={form.field}
onChange={handleChange}
/>
</div>



<div className="form-group">
<label>Lokacioni</label>

<input
name="location"
type="text"
placeholder="Vienë, Austri"
value={form.location}
onChange={handleChange}
/>
</div>



<div className="form-group">
<label>Afati i Aplikimit</label>

<input
name="submission_deadline"
type="date"
value={form.submission_deadline}
onChange={handleChange}
required
/>
</div>



<div className="form-group">
<label>Data e Konferencës</label>

<input
name="conference_date"
type="date"
value={form.conference_date}
onChange={handleChange}
/>
</div>



<div className="form-group form-wide">
<label>Web Faqja</label>

<input
name="website"
type="url"
placeholder="https://konferenca.com"
value={form.website}
onChange={handleChange}
/>
</div>



<button
type="submit"
className="conference-submit-btn"
>
+ Shto Konferencë
</button>

</form>

</section>




<section className="conference-panel">

<div className="conference-header">
<div>
<h2>Konferencat ekzistuese</h2>

<p>
Pjesëmarrjet dhe afatet e ardhshme.
</p>
</div>
</div>



<div className="conference-list">

{conferences.map((conf)=>{

const status=getDeadlineStatus(
conf.submission_deadline
);

return(

<div
className="conference-card"
key={conf.id}
>

<div className="conference-icon">
📅
</div>



<div className="conference-details">

<h3>
{conf.title}

{conf.acronym &&
<span>
({conf.acronym})
</span>
}
</h3>


<p>
{conf.location || "Pa lokacion"}
</p>


<div className="conference-meta">
<span>
{conf.field || "Pa fushë"}
</span>

<span>
Afati:
{conf.submission_deadline}
</span>
</div>


{conf.website &&(
<a
href={conf.website}
target="_blank"
rel="noreferrer"
>
Vizito Faqen
</a>
)}

</div>




<div className="conference-actions">

<span
className={`status-badge ${
status==="Hapur"
?"open"
:status==="Mbyllet së shpejti"
?"closing-soon"
:"closed"
}`}
>
{status}
</span>



<button
onClick={()=>
deleteConference(conf.id)
}
>
Fshij
</button>

</div>

</div>

);

})}

</div>

</section>

</div>
);

}

export default ConferenceManager;