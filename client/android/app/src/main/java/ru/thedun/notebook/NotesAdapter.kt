package ru.thedun.notebook

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import ru.thedun.notebook.databinding.ListItemNotePreviewBinding

class NotesAdapter(private val myDataset: List<String>) :
    RecyclerView.Adapter<NotesAdapter.MyViewHolder>() {
    class MyViewHolder(val binding: ListItemNotePreviewBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MyViewHolder {
        return MyViewHolder(
            ListItemNotePreviewBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        )
    }

    override fun onBindViewHolder(holder: MyViewHolder, position: Int) {
        holder.binding.textView.text = myDataset[position]
    }

    override fun getItemCount(): Int = myDataset.size
}