const pathParts=location.pathname.split('/').filter(Boolean);const institutionId=pathParts[1]||'demo';const mode=pathParts[2]==='signup'?'signup':'login';
const institutionLabels={happyprancer:'HappyPrancer',bworkz:'Bworkz',awsaiapp:'AWSAIAPP'};
const form=document.getElementById('authForm'), title=document.getElementById('title'), subtitle=document.getElementById('subtitle'), submit=document.getElementById('submitButton'), switchAuth=document.getElementById('switchAuth'), google=document.getElementById('googleButton'), forgot=document.getElementById('forgotPassword'), message=document.getElementById('message');
const signupFields=document.getElementById('signupFields'), confirmWrap=document.getElementById('confirmWrap'), referralWrap=document.getElementById('referralWrap'), roleWrap=document.getElementById('roleWrap'), password=document.getElementById('password'), email=document.getElementById('email');
document.getElementById('institutionName').textContent=institutionLabels[institutionId]||institutionId;
function setMode(next){const signup=next==='signup';title.textContent=signup?'Create Account':'Sign in';subtitle.textContent=signup?'Create a test account using the common signup fields.':'Use the test credentials to sign in.';submit.textContent=signup?'Create Account':(institutionId==='bworkz'?'Continue':'Sign In');signupFields.hidden=!signup;confirmWrap.hidden=!signup;referralWrap.hidden=!signup;roleWrap.hidden=institutionId!=='bworkz'||signup;switchAuth.textContent=signup?'Login':'Sign Up';message.textContent='';}
setMode(mode);
switchAuth.onclick=e=>{e.preventDefault();location.href=`/auth/${institutionId}/${mode==='signup'?'login':'signup'}`};
forgot.onclick=e=>{e.preventDefault();message.textContent='Forgot password flow is available for testing.'};
google.onclick=()=>{message.textContent='Google authentication option is available.'};
function updateRules(){const v=password.value;const rules={length:v.length>=8,upper:/[A-Z]/.test(v),lower:/[a-z]/.test(v),number:/\d/.test(v),special:/[^A-Za-z0-9]/.test(v)};for(const [k,ok] of Object.entries(rules)){const el=document.querySelector(`[data-rule="${k}"]`);el.classList.toggle('ok',ok);el.classList.toggle('bad',v.length>0&&!ok)}}password.addEventListener('input',updateRules);updateRules();
form.addEventListener('submit',e=>{e.preventDefault();message.textContent='';
 if(!email.checkValidity()){email.reportValidity();return}
 const v=password.value;
 if(v.length<8){message.textContent='Password must contain at least 8 characters';return}
 if(!/[A-Z]/.test(v)){message.textContent='Password must have uppercase characters';return}
 if(!/[a-z]/.test(v)){message.textContent='Password must have lowercase characters';return}
 if(!/\d/.test(v)){message.textContent='Password must have numeric characters';return}
 if(!/[^A-Za-z0-9]/.test(v)){message.textContent='Password must have symbol characters';return}
 if(mode==='signup'){
   const confirm=document.getElementById('confirmPassword');
   if(confirm.value!==v){message.textContent='Passwords must match';return}
   message.textContent='Account created successfully';setTimeout(()=>location.href=`/auth/${institutionId}/dashboard`,250);
   return;
 }
 const validEmail=window.AUTH_TEST_EMAIL||'testuser@example.com';const validPassword=window.AUTH_TEST_PASSWORD||'Test@1234';
 // The server injects institution-specific credentials into these values.
 if(email.value===validEmail && v===validPassword){submit.textContent='Signing in';setTimeout(()=>location.href=`/auth/${institutionId}/dashboard`,250)}else{message.textContent="Invalid credentials"}
});
