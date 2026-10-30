const origin='https://dev.four-symbols-dev.pages.dev';
export async function probe(fetcher){
  const results=[];
  for(const path of ['/release-manifest.json','/index.html','/']){
    let response;
    try {response=await fetcher(origin+path);} catch(error) {results.push({path,phase:'network-error',code:['ETIMEDOUT','ECONNRESET','ENOTFOUND','EAI_AGAIN'].includes(error?.cause?.code)?error.cause.code:'unknown'});continue;}
    const result={path,status:response.status};
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');
      try {const target=new URL(location,origin+path);result.redirect=target.origin===origin?target.pathname:'external';} catch {result.redirect='invalid';}
    }
    if(response.status===200&&path==='/release-manifest.json'){
      try {const data=await response.json();result.sha=/^[0-9a-f]{40}$/.test(data.commitSha)?data.commitSha:'invalid';}catch{result.sha='invalid-json';}
    }
    if(response.status===200&&(path==='/'||path==='/index.html')) result.marker=(await response.text()).includes('<!-- build:critical-script -->');
    results.push(result);
  }
  return results;
}
