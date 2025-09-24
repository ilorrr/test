:root{
    --bg: #0f172a;
    --card: #1e293b;
    --text: #f1f5f9;
    --muted: #94a3b8;
    --primary: #7c3aed;
    --primary-600: #6d28d9;
    --border: #334155;
    --danger: #ef4444;
    --ok: #22c55e;
    --warn: #f59e0b;
}

*{box-sizing: border-box;}

html, body{
    height: 100%;
    margin: 0;
}

body{
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Open Sans', 'Helvetica Neue', sans-serif;
    color: var(--text);
    background: var(--bg);
}

.topbar{
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 30;
}

.brand{font-weight: 700;}

.spacer{flex: 1;}

.icon-btn{
    border: 1px solid var(--border);
    background: var(--bg);
    border-radius: 10px;
    padding: 8px 10px;
    cursor: pointer;
}

.shell{
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: calc(100vh - 60px);
}

.sidebar{
    background: var(--bg);
    border-right: 1px solid var(--border);
    padding: 16px;
    position: sticky;
    top: 60px;
    height: calc(100vh - 60px);
    overflow: auto;
}

.content{
    padding: 20px;
    max-width: 1200px;
    width: 100%;
}

.sidebar-section{margin-bottom: 18px;}

.sidebar-title{
    font-size: .8rem;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 6px;
}

.sidebar-link{
    display: block;
    padding: 8px 10px;
    border-radius: 8px;
    color: inherit;
    text-decoration: none;
}

.sidebar-link:hover {background: #f3f4f6;}

.card{
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 04);
    padding: 18px;
}

.grid{
    display: grid;
    gap: 16px;
}

.grid.cols-2{grid-template-columns: repeat(2, minmax(0, 1fr));}
.grid.cols-3{grid-template-columns: repeat(3, minmax(0, 1fr));}
.grid.cols-4{grid-template-columns: repeat(4, minmax(0, 1fr));}

h1, h2{margin: 0 0 10px;}

p{
    margin: 0 0 12px;
    color: var(--muted);
}

.form{
    display: grid;
    gap: 12px;
    margin-top: 12px;
}

.input, .select, .textarea{
    width: 100%;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    outline: none;
    background: #fff;
}

.input:focus, .select:focus, textarea:focus{border-color: var(--primary);}

.btn{
    padding: 12px 14px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}

.btn-primary{
    background: var(--primary);
    color: #fff;
}

.btn-primary:hover{
    background: var(--primary-600);
}

.btn-outline{
    background: #fff;
    color: var(--primary);
    border: 1px solid var(--primary);
}

.btn-outline:hover{
    background: var(--primary);
    color: #fff;
}

.row{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.link{
    color: var(--primary);
    text-decoration: none;
}

.link:hover{text-decoration: underline;}

.alert{
    font-size: .9rem;
    margin-top: 6px;
}

.alert.error{color: var(--danger);}

.alert.success{color: var(--ok);}

.helper{
    font-size: .85rem;
    color: var(--muted);
}

.meter{
    height: 8px;
    border-radius: 6px;
    background: #e5e7eb;
    overflow: hidden;
}

.meter-fill{
    height: 100%;
    width: 0%;
}

.strength-1 .meter-fill{
    width: 25%;
    background: var(--danger);
}

.strength-2 .meter-fill{
    width: 50%;
    background: var(--warn);
}

.strength-3 .meter-fill{
    width: 75%;
    background: #10b981;
}

.strength-4 .meter-fill{
    width: 100%;
    background: #059669;
}

.footer{
    padding: 24px 0 40px;
    text-align: center;
    color: var(--muted);
}

.hidden{display: none !important;}

@media (max-width: 960px){
    .shell{grid-template-columns: 1fr;}

    .sidebar{
        position: fixed;
        top: 60px;
        left: 0;
        width: 280px;
        transform: translateX(-100%);
        transition: transform .2s ease;
    }

    .sidebar.open{transform: translateX(0);}

    .content{padding: 16px;}

    .grid.cols-4{grid-template-columns: repeat(2, minmax(0, 1fr));}
}

@media (max-width: 640px){
    .grid.cols-3, .grid.cols-2, .grid.cols-4{grid-template-columns: 1fr;}
}

body.auth{background: #f4f4f9;}

body.auth #shell{display: block !important;}

body.auth #sidebar{display: none !important;}

body.auth #app{
    max-width: 420px !important;
    margin: 48px auto !important;
    padding: 0 16px;
}

body.auth .card{
    border-radius: 10px;
    box-shadow: 0 0 10px #ccc;
    padding: 24px;
}

body.auth .input{
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 5px;
}

body.auth .btn-primary{
    width: 100%;
    padding: 10px 12px;
    background: #4f46e5;
    color: #fff;
    border-radius: 5px;
}

body.auth .btn-primary:hover{background: #4338ca;}

body.auth .alert{margin-top: 10px;}
