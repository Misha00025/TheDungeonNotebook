package ru.thedun.notebook

import android.annotation.SuppressLint
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import ru.thedun.notebook.databinding.ActivityNotesBinding

class MainActivity : AppCompatActivity() {

    private var _binding: ActivityNotesBinding? = null
    private val binding
        get() = _binding?:throw IllegalStateException("Binding for ActivityNotesBinding must not be null")

    @SuppressLint("SetTextI18n")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        _binding = ActivityNotesBinding.inflate(layoutInflater)
        setContentView(binding.root)
        var i = 0
        with(binding){
            val text = tvCharacterName.text
            tvCharacterName.setOnClickListener {
                tvCharacterName.text = "$text $i"
                i += 1
            }
        }
    }
}