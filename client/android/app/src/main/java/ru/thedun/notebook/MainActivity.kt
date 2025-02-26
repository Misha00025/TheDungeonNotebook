package ru.thedun.notebook

import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_notes)
        val myDataset = MutableList<String>(200, { i -> "Item $i"})

        val viewManager = LinearLayoutManager(this)
        val viewAdapter = NotesAdapter(myDataset)

        val tvCharacterName: TextView = findViewById(R.id.tvCharacterName)
        val llNotes: RecyclerView = findViewById(R.id.rvNotes)
        llNotes.apply {
            setHasFixedSize(true)
            layoutManager = viewManager
            adapter = viewAdapter
        }
    }
}