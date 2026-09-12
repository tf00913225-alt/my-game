package com.foursymbols.jianghu.authpoc

import android.content.Intent
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

/**
 * Android-native Facebook Login PoC owner.
 *
 * Scope is deliberately narrow: native Meta LoginManager -> Firebase credential ->
 * Firebase UID display. This activity never hosts the game, never opens a WebView,
 * and never reads or writes Firestore, local game saves, ownership metadata, or
 * character data.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var callbackManager: CallbackManager
    private lateinit var statusText: TextView
    private lateinit var uidText: TextView
    private lateinit var loginButton: Button
    private lateinit var clearSessionButton: Button
    private var firebaseAuth: FirebaseAuth? = null

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
            firebaseAuth = FirebaseAuth.getInstance()
            showStatus(getString(R.string.ready_for_native_login))
            firebaseAuth?.currentUser?.let(::renderSignedInUser)
        } catch (_: IllegalStateException) {
            loginButton.isEnabled = false
            clearSessionButton.isEnabled = false
            showError(getString(R.string.firebase_initialization_failed))
        }
    }

    private fun registerNativeFacebookCallback() {
        LoginManager.getInstance().registerCallback(
            callbackManager,
            object : FacebookCallback<LoginResult> {
                override fun onSuccess(loginResult: LoginResult) {
                    signInToFirebase(loginResult.accessToken)
                }

                override fun onCancel() {
                    showStatus(getString(R.string.facebook_login_cancelled))
                }

                override fun onError(error: FacebookException) {
                    // Do not display or log access tokens, OAuth URLs, or provider details.
                    showError(getString(R.string.facebook_login_failed))
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
        // The PoC needs only the Facebook subject to obtain a Firebase credential and
        // compare its UID. It deliberately does not request email or any game data.
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
            if (task.isSuccessful) {
                val user = auth.currentUser
                if (user == null) {
                    showError(getString(R.string.firebase_user_missing))
                } else {
                    renderSignedInUser(user)
                }
            } else {
                showError(getString(R.string.firebase_sign_in_failed))
            }
        }
    }

    private fun clearPocSession() {
        firebaseAuth?.signOut()
        LoginManager.getInstance().logOut()
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
}
