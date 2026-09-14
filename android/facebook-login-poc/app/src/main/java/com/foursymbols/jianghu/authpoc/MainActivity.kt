package com.foursymbols.jianghu.authpoc

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.facebook.AccessToken
import com.facebook.CallbackManager
import com.facebook.FacebookCallback
import com.facebook.FacebookException
import com.facebook.login.LoginManager
import com.facebook.login.LoginResult
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.FacebookAuthProvider
import com.google.firebase.functions.FirebaseFunctions

/**
 * Android-native Facebook Login helper for the browser game.
 *
 * The browser never receives a Facebook access token. Native Meta Login signs into
 * Firebase Android Auth, then an authenticated callable Function creates a short-lived
 * one-time handoff code. Only allow-listed HTTPS game origins may receive that code.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var callbackManager: CallbackManager
    private lateinit var statusText: TextView
    private lateinit var uidText: TextView
    private lateinit var loginButton: Button
    private lateinit var clearSessionButton: Button
    private var firebaseAuth: FirebaseAuth? = null
    private var firebaseFunctions: FirebaseFunctions? = null
    private var pendingReturnUri: Uri? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.statusText)
        uidText = findViewById(R.id.uidText)
        loginButton = findViewById(R.id.facebookLoginButton)
        clearSessionButton = findViewById(R.id.clearPocSessionButton)
        callbackManager = CallbackManager.Factory.create()

        registerNativeFacebookCallback()
        loginButton.setOnClickListener { startNativeFacebookLogin() }
        clearSessionButton.setOnClickListener { clearPocSession() }

        initializeFirebaseForPoc()
        handleIncomingAuthIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingAuthIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        firebaseAuth?.currentUser?.let(::renderSignedInUser)
    }

    @Deprecated("Facebook SDK routes the native login result through this callback.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        callbackManager.onActivityResult(requestCode, resultCode, data)
    }

    private fun initializeFirebaseForPoc() {
        if (!BuildConfig.HAS_GOOGLE_SERVICES_JSON) {
            loginButton.isEnabled = false
            clearSessionButton.isEnabled = false
            showError(getString(R.string.missing_google_services_json))
            return
        }

        try {
            val app = FirebaseApp.initializeApp(this)
            if (app == null) {
                loginButton.isEnabled = false
                clearSessionButton.isEnabled = false
                showError(getString(R.string.firebase_initialization_failed))
                return
            }
            firebaseAuth = FirebaseAuth.getInstance(app)
            firebaseFunctions = FirebaseFunctions.getInstance(app, FUNCTIONS_REGION)
            showStatus(getString(R.string.ready_for_native_login))
            firebaseAuth?.currentUser?.let(::renderSignedInUser)
        } catch (_: IllegalStateException) {
            loginButton.isEnabled = false
            clearSessionButton.isEnabled = false
            showError(getString(R.string.firebase_initialization_failed))
        }
    }

    private fun handleIncomingAuthIntent(incoming: Intent?) {
        val data = incoming?.data ?: return
        if (data.scheme != NATIVE_AUTH_SCHEME || data.host != NATIVE_AUTH_HOST || data.path != NATIVE_AUTH_PATH) {
            return
        }

        val returnValue = data.getQueryParameter("return")
        val returnUri = returnValue?.let(Uri::parse)
        if (returnUri == null || !isAllowedReturnUri(returnUri)) {
            showError(getString(R.string.native_return_url_rejected))
            return
        }

        pendingReturnUri = returnUri
        startNativeFacebookLogin()
    }

    private fun isAllowedReturnUri(uri: Uri): Boolean {
        if (uri.scheme != "https") return false
        if (uri.port != -1 && uri.port != 443) return false
        val host = uri.host?.lowercase() ?: return false
        return host in ALLOWED_RETURN_HOSTS
    }

    private fun registerNativeFacebookCallback() {
        LoginManager.getInstance().registerCallback(
            callbackManager,
            object : FacebookCallback<LoginResult> {
                override fun onSuccess(loginResult: LoginResult) {
                    signInToFirebase(loginResult.accessToken)
                }

                override fun onCancel() {
                    if (pendingReturnUri != null) {
                        returnToBrowserWithError("cancelled")
                    } else {
                        showStatus(getString(R.string.facebook_login_cancelled))
                    }
                }

                override fun onError(error: FacebookException) {
                    if (pendingReturnUri != null) {
                        returnToBrowserWithError("facebook-login-failed")
                    } else {
                        showError(getString(R.string.facebook_login_failed))
                    }
                }
            }
        )
    }

    private fun startNativeFacebookLogin() {
        if (firebaseAuth == null) {
            showError(getString(R.string.firebase_not_ready))
            return
        }

        showStatus(getString(R.string.opening_native_facebook_login))
        LoginManager.getInstance().logInWithReadPermissions(this, listOf("public_profile"))
    }

    private fun signInToFirebase(accessToken: AccessToken) {
        val auth = firebaseAuth
        if (auth == null) {
            showError(getString(R.string.firebase_not_ready))
            return
        }

        showStatus(getString(R.string.exchanging_facebook_credential))
        val credential = FacebookAuthProvider.getCredential(accessToken.token)
        auth.signInWithCredential(credential).addOnCompleteListener(this) { task ->
            if (!task.isSuccessful) {
                if (pendingReturnUri != null) {
                    returnToBrowserWithError("firebase-sign-in-failed")
                } else {
                    showError(getString(R.string.firebase_sign_in_failed))
                }
                return@addOnCompleteListener
            }

            val user = auth.currentUser
            if (user == null) {
                showError(getString(R.string.firebase_user_missing))
                return@addOnCompleteListener
            }

            renderSignedInUser(user)
            if (pendingReturnUri != null) {
                createNativeAuthHandoff(user)
            }
        }
    }

    private fun createNativeAuthHandoff(user: FirebaseUser) {
        val functions = firebaseFunctions
        if (functions == null) {
            returnToBrowserWithError("functions-not-ready")
            return
        }

        showStatus(getString(R.string.creating_native_handoff))
        user.getIdToken(true).addOnCompleteListener(this) { tokenTask ->
            if (!tokenTask.isSuccessful || tokenTask.result?.token.isNullOrBlank()) {
                returnToBrowserWithError("firebase-token-failed")
                return@addOnCompleteListener
            }

            functions
                .getHttpsCallable("createNativeAuthHandoff")
                .call()
                .addOnCompleteListener(this) { task ->
                    if (!task.isSuccessful) {
                        returnToBrowserWithError("handoff-create-failed")
                        return@addOnCompleteListener
                    }
                    val data = task.result?.data as? Map<*, *>
                    val code = data?.get("code") as? String
                    if (code.isNullOrBlank()) {
                        returnToBrowserWithError("handoff-code-missing")
                        return@addOnCompleteListener
                    }
                    returnToBrowserWithCode(code)
                }
        }
    }

    private fun returnToBrowserWithCode(code: String) {
        val returnUri = pendingReturnUri ?: return
        if (!HANDOFF_CODE_PATTERN.matches(code)) {
            returnToBrowserWithError("handoff-code-invalid")
            return
        }
        val callback = returnUri.buildUpon()
            .fragment("nativeAuthCode=$code")
            .build()
        pendingReturnUri = null
        startActivity(Intent(Intent.ACTION_VIEW, callback).addCategory(Intent.CATEGORY_BROWSABLE))
        finish()
    }

    private fun returnToBrowserWithError(code: String) {
        val returnUri = pendingReturnUri
        pendingReturnUri = null
        if (returnUri == null) {
            showError(getString(R.string.native_handoff_failed))
            return
        }
        val safeCode = code.replace(Regex("[^a-z0-9-]"), "")
        val callback = returnUri.buildUpon()
            .fragment("nativeAuthError=$safeCode")
            .build()
        startActivity(Intent(Intent.ACTION_VIEW, callback).addCategory(Intent.CATEGORY_BROWSABLE))
        finish()
    }

    private fun clearPocSession() {
        firebaseAuth?.signOut()
        LoginManager.getInstance().logOut()
        pendingReturnUri = null
        uidText.text = getString(R.string.uid_not_signed_in)
        uidText.visibility = View.VISIBLE
        showStatus(getString(R.string.poc_session_cleared))
    }

    private fun renderSignedInUser(user: FirebaseUser) {
        uidText.text = user.uid
        uidText.visibility = View.VISIBLE
        showStatus(getString(R.string.firebase_uid_ready))
    }

    private fun showStatus(message: String) {
        statusText.setTextColor(ContextCompat.getColor(this, R.color.status_ok))
        statusText.text = message
    }

    private fun showError(message: String) {
        statusText.setTextColor(ContextCompat.getColor(this, R.color.status_error))
        statusText.text = message
    }

    companion object {
        private const val FUNCTIONS_REGION = "us-central1"
        private const val NATIVE_AUTH_SCHEME = "foursymbols"
        private const val NATIVE_AUTH_HOST = "auth"
        private const val NATIVE_AUTH_PATH = "/facebook"
        private val HANDOFF_CODE_PATTERN = Regex("^[A-Za-z0-9_-]{43}$")
        private val ALLOWED_RETURN_HOSTS = setOf(
            "dev.four-symbols-dev.pages.dev",
            "four-symbols-dev.pages.dev",
            "tf00913225-alt.github.io"
        )
    }
}
